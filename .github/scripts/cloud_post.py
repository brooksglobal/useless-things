#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
깃허브 서버 예약 게시 (GitHub Actions 가 15분마다 실행)

- 게시 대기 편은 「초안(draft) 릴리스」 ep-<편> 에 final.mp4, thumb.png(커버), cover.jpg(목록 표지), post.json 으로 올려 둡니다.
  초안은 일반 사람에게 보이지 않습니다.
- post.json 의 at(게시 시각)이 16분 안으로 다가오면 그 시각까지 기다렸다가:
  1) 릴리스를 공개로 바꿔 영상 주소를 공개
  2) 인스타그램 Graph API 로 릴스 게시(커버 포함)
  3) 릴리스 본문에 "POSTED: <릴스 주소>" 기록 (맥의 예비 게시는 이 표시를 보고 건너뜀)
  4) 목록 페이지(index.html) 맨 위에 그 편을 추가하고 표지를 커밋·푸시
- 비밀값: IG_USER_ID, IG_ACCESS_TOKEN (저장소 Secrets). 토큰은 로그에 찍지 않습니다.

수동 실행(workflow_dispatch) 의 dry_run=true 는 게시하지 않고 대기 목록만 보여 줍니다.
"""
import datetime as dt, json, os, subprocess, sys, time, urllib.parse, urllib.request

REPO = os.environ.get('GITHUB_REPOSITORY', 'brooksglobal/useless-things')
GH_TOKEN = os.environ.get('GH_TOKEN', '')
DRY = os.environ.get('DRY_RUN', 'false') == 'true'
LOOKAHEAD = 16 * 60
KST = dt.timezone(dt.timedelta(hours=9))

def gh(method, path, body=None, accept='application/vnd.github+json'):
    req = urllib.request.Request('https://api.github.com' + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': 'Bearer ' + GH_TOKEN, 'Accept': accept, 'X-GitHub-Api-Version': '2022-11-28'})
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
        return raw if accept == 'application/octet-stream' else (json.loads(raw) if raw else {})

def graph_base(token):
    return 'https://graph.instagram.com/v21.0' if token.startswith('IGAA') else 'https://graph.facebook.com/v21.0'

def ig(method, path, params, token):
    params = dict(params); params['access_token'] = token
    base = graph_base(token)
    if method == 'POST':
        req = urllib.request.Request(base + path, data=urllib.parse.urlencode(params).encode(), method='POST')
    else:
        req = urllib.request.Request(base + path + '?' + urllib.parse.urlencode(params))
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try: err = json.loads(e.read().decode()).get('error', {})
        except Exception: err = {}
        raise RuntimeError('Graph API 오류 %s: %s (code %s)' % (e.code, err.get('message'), err.get('code')))

def wait_public(url, sec=120):
    for _ in range(sec // 5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=20) as r:
                if r.status == 200: return True
        except Exception: pass
        time.sleep(5)
    return False

def add_to_list(meta, rel):
    """목록 페이지 맨 위에 추가 + cover.jpg 커밋·푸시"""
    cover = next((a for a in rel['assets'] if a['name'] == 'cover.jpg'), None)
    if cover:
        os.makedirs('apps/%s' % meta['slug'], exist_ok=True)
        open('apps/%s/cover.jpg' % meta['slug'], 'wb').write(gh('GET', '/repos/%s/releases/assets/%d' % (REPO, cover['id']), accept='application/octet-stream'))
    s = open('index.html', encoding='utf-8').read()
    if "url: 'apps/%s/'" % meta['slug'] not in s:
        js = lambda t: t.replace('\\', '\\\\').replace("'", "\\'")
        s = s.replace("const APPS = [\n", "const APPS = [\n  { n: %d, name: '%s', desc: '%s',\n    url: 'apps/%s/', cover: 'apps/%s/cover.jpg', label: '열기' },\n" % (meta['n'], js(meta['name']), js(meta['desc']), meta['slug'], meta['slug']), 1)
        open('index.html', 'w', encoding='utf-8').write(s)
    subprocess.run(['git', 'config', 'user.name', 'useless-things-bot'], check=True)
    subprocess.run(['git', 'config', 'user.email', 'actions@users.noreply.github.com'], check=True)
    subprocess.run(['git', 'add', 'index.html', 'apps/%s/cover.jpg' % meta['slug']], check=True)
    if subprocess.run(['git', 'diff', '--cached', '--quiet']).returncode != 0:
        subprocess.run(['git', 'commit', '-q', '-m', '목록 페이지: #%d %s (예약 게시)' % (meta['n'], meta['name'])], check=True)
        subprocess.run(['git', 'push', '-q'], check=True)

def post(rel, meta):
    tag = rel['tag_name']
    uid, token = os.environ.get('IG_USER_ID', ''), os.environ.get('IG_ACCESS_TOKEN', '')
    if not uid or not token: raise RuntimeError('저장소 Secrets 에 IG_USER_ID / IG_ACCESS_TOKEN 이 없습니다.')
    # 1) 공개로 전환
    gh('PATCH', '/repos/%s/releases/%d' % (REPO, rel['id']), {'draft': False, 'body': 'POSTING: %s' % dt.datetime.now(KST).isoformat(timespec='minutes')})
    video = 'https://github.com/%s/releases/download/%s/final.mp4' % (REPO, tag)
    cover = 'https://github.com/%s/releases/download/%s/thumb.png' % (REPO, tag)
    if not wait_public(video): raise RuntimeError('영상 주소가 공개되지 않았습니다: ' + video)
    # 2) 인스타 게시
    params = {'media_type': 'REELS', 'video_url': video, 'caption': meta['caption'], 'share_to_feed': 'true'}
    if any(a['name'] == 'thumb.png' for a in rel['assets']): params['cover_url'] = cover
    cid = ig('POST', '/%s/media' % uid, params, token)['id']; print('컨테이너', cid)
    for _ in range(60):
        st = ig('GET', '/%s' % cid, {'fields': 'status_code'}, token).get('status_code'); print('  상태', st)
        if st == 'FINISHED': break
        if st in ('ERROR', 'EXPIRED'): raise RuntimeError('컨테이너 처리 실패: %s' % st)
        time.sleep(10)
    else: raise RuntimeError('10분 안에 처리되지 않았습니다.')
    mid = ig('POST', '/%s/media_publish' % uid, {'creation_id': cid}, token)['id']
    link = ig('GET', '/%s' % mid, {'fields': 'permalink'}, token).get('permalink', '')
    print('게시 완료', link)
    # 3) 표시
    gh('PATCH', '/repos/%s/releases/%d' % (REPO, rel['id']), {'body': 'POSTED: %s\nAT: %s' % (link, dt.datetime.now(KST).isoformat(timespec='minutes'))})
    # 4) 목록 페이지
    add_to_list(meta, rel)

def main():
    rels = gh('GET', '/repos/%s/releases?per_page=50' % REPO)
    now = dt.datetime.now(dt.timezone.utc)
    queue = []
    for r in rels:
        if not r['draft'] or not r['tag_name'].startswith('ep-'): continue
        pj = next((a for a in r['assets'] if a['name'] == 'post.json'), None)
        if not pj: continue
        meta = json.loads(gh('GET', '/repos/%s/releases/assets/%d' % (REPO, pj['id']), accept='application/octet-stream'))
        at = dt.datetime.fromisoformat(meta['at'])
        queue.append((at, r, meta))
    queue.sort(key=lambda x: x[0])
    for at, r, meta in queue:
        left = (at - now).total_seconds()
        print('%s  #%s %s  게시 %s  (%s분 남음)' % (r['tag_name'], meta['n'], meta['name'], at.astimezone(KST).strftime('%m/%d %H:%M'), int(left // 60)))
    if DRY:
        uid, token = os.environ.get('IG_USER_ID', ''), os.environ.get('IG_ACCESS_TOKEN', '')
        if uid and token:
            me = ig('GET', '/%s' % uid, {'fields': 'username,media_count'}, token)
            print('인스타 연결 확인: @%s (게시물 %s개)' % (me.get('username'), me.get('media_count')))
        else: print('Secrets 없음')
        return
    for at, r, meta in queue:
        left = (at - dt.datetime.now(dt.timezone.utc)).total_seconds()
        if left > LOOKAHEAD: continue
        if left < -3 * 3600: print('3시간 넘게 지난 예약이라 건너뜀(수동 확인 필요):', r['tag_name']); continue
        if left > 0: print('%d초 기다림' % left); time.sleep(left)
        try:
            post(r, meta)
        except Exception as e:
            print('실패:', e)
            try: gh('PATCH', '/repos/%s/releases/%d' % (REPO, r['id']), {'body': 'FAILED: %s' % str(e)[:500]})
            except Exception: pass
            sys.exit(1)

if __name__ == '__main__':
    main()

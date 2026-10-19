#!/usr/bin/env python3
"""HTTP smoke for an explicitly enabled demo instance. Uses only Python's standard library."""
import argparse
import http.cookiejar
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from uuid import uuid4


class Client:
    def __init__(self, base, account=None):
        self.base = base.rstrip('/')
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.csrf = None
        self.user = None
        if account:
            session = self.call('POST', '/demo/session', {'accountId': account})
            self.csrf = session['csrfToken']
            self.user = session['user']['id']

    def call(self, method, path, body=None, expected=200):
        data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
        headers = {'Accept': 'application/json'}
        if data is not None:
            headers['Content-Type'] = 'application/json'
        if self.csrf and method != 'GET':
            headers['X-CSRF-Token'] = self.csrf
        request = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
        try:
            response = self.opener.open(request, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read()
            result = json.loads(raw) if raw else None
            if response.code not in (expected if isinstance(expected, tuple) else (expected,)):
                raise AssertionError(f'{method} {path}: expected {expected}, got {response.code}; {result}')
            return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='http://localhost:8080/api/v1')
    args = parser.parse_args()
    public = Client(args.base)
    assert public.call('GET', '/health')['status'] == 'UP'
    owner, a, b, c, admin = [Client(args.base, account) for account in ('coach', 'athlete-a', 'athlete-b', 'athlete-c', 'admin')]
    label = uuid4().hex[:10]
    starts = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()

    signup = Client(args.base)
    signup_name = f'new-user-{label}'
    session = signup.call('POST', '/demo/accounts', {'nickname': signup_name, 'displayName': signup_name}, 201)
    signup.csrf, signup.user = session['csrfToken'], session['user']['id']
    assert session['systemRoles'] == ['USER'] and session['user']['ratingPoints'] == 0
    assert signup.call('GET', '/session')['user']['id'] == signup.user
    signup.call('PATCH', '/me/profile', {'bio': 'Проверка регистрации и повторного входа'})
    account = next(item['id'] for item in public.call('GET', '/demo/accounts') if item['label'] == signup_name)
    signup.call('DELETE', '/demo/session', expected=204)
    restored = Client(args.base, account)
    assert restored.user == signup.user
    assert restored.call('GET', '/me/profile')['bio'] == 'Проверка регистрации и повторного входа'
    public.call('POST', '/demo/accounts', {'nickname': signup_name.upper(), 'displayName': 'Дубликат'}, 409)
    created_by_signup = restored.call('POST', '/events', {
        'title': f'Signup smoke {label}', 'description': 'Событие нового зарегистрированного пользователя',
        'sport': {'customName': f'Новый спорт {label}'}, 'startsAt': starts,
        'location': {'city': 'Самара', 'address': 'Спортивная площадка'},
        'requirements': 'Удобная одежда и вода', 'joinMode': 'OPEN',
        'organizer': {'type': 'USER', 'id': restored.user},
    }, 201)
    assert a.call('GET', f'/events/{created_by_signup["id"]}')['requirements'] == 'Удобная одежда и вода'
    assert a.call('GET', f'/users/{restored.user}')['nickname'] == signup_name
    print('Регистрация OK: новый USER, сессия/CSRF, повторный вход, защита от дубля, создание события')

    def event(mode, organizer=None):
        return owner.call('POST', '/events', {
            'title': f'Smoke {mode} {label}',
            'description': 'Совместная спортивная встреча для проверки серверных сценариев',
            'sport': {'customName': f'Новый спорт {label}'},
            'startsAt': starts,
            'location': {'city': 'Самара', 'address': 'Спортивная площадка'},
            'joinMode': mode,
            'maxParticipants': 2,
            'organizer': organizer or {'type': 'USER', 'id': owner.user},
        }, 201)['id']

    opened = event('OPEN')
    assert a.call('GET', f'/events/{opened}')['status'] == 'PUBLISHED'
    query = urllib.parse.urlencode({'sport': f'Новый спорт {label}', 'city': 'Самара'})
    assert opened in [item['id'] for item in b.call('GET', '/events?' + query)['items']]
    b.call('PATCH', f'/events/{opened}', {'title': 'Чужое событие'}, 403)
    print('S1 OK: новый спорт, публикация, поиск, защита владельца')

    org_body = {'name': f'Клуб {label}', 'description': 'Демонстрационное спортивное сообщество'}
    org = owner.call('POST', '/organizations', org_body, 201)['id']
    assert owner.call('GET', f'/organizations/{org}')['status'] == 'PENDING'
    public.call('GET', f'/organizations/{org}', expected=404)
    forbidden_event = {
        'title': f'Недопущенная организация {label}',
        'description': 'Публикация до одобрения должна быть запрещена',
        'sport': {'customName': f'Новый спорт {label}'}, 'startsAt': starts,
        'location': {'city': 'Самара', 'address': 'Парк'}, 'joinMode': 'OPEN',
        'organizer': {'type': 'ORGANIZATION', 'id': org},
    }
    owner.call('POST', '/events', forbidden_event, 403)
    admin.call('POST', f'/admin/organizations/{org}/decision', {'decision': 'APPROVE'})
    published = event('OPEN', {'type': 'ORGANIZATION', 'id': org})
    assert public.call('GET', f'/organizations/{org}')['status'] == 'APPROVED'
    assert published in [item['id'] for item in a.call('GET', f'/organizations/{org}/events')['items']]
    rejected = owner.call('POST', '/organizations', {**org_body, 'name': f'Другой клуб {label}'}, 201)['id']
    admin.call('POST', f'/admin/organizations/{rejected}/decision', {'decision': 'REJECT'}, 400)
    admin.call('POST', f'/admin/organizations/{rejected}/decision', {'decision': 'REJECT', 'reason': 'Уточните деятельность'})
    assert owner.call('GET', f'/organizations/{rejected}')['decisionReason'] == 'Уточните деятельность'
    print('S2 OK: запрет до допуска, одобрение, отказ, публикация организации')

    assert a.call('POST', f'/events/{opened}/registrations', {}, 201)['status'] == 'CONFIRMED'
    a.call('POST', f'/events/{opened}/registrations', {}, 409)
    assert a.user in [user['id'] for user in owner.call('GET', f'/events/{opened}/participants')['items']]
    assert a.call('GET', f'/events/{opened}/my-registration')['status'] == 'CONFIRMED'
    print('S3 OK: OPEN, подтверждение, видимость участника, запрет дубля')

    approval = event('APPROVAL')
    ra = a.call('POST', f'/events/{approval}/registrations', {}, 201)
    rb = b.call('POST', f'/events/{approval}/registrations', {}, 201)
    assert ra['status'] == rb['status'] == 'PENDING'
    assert owner.call('GET', f'/events/{approval}/participants')['total'] == 0
    admin.call('POST', f'/events/{approval}/registrations/{ra["id"]}/decision', {'decision': 'APPROVE'}, 403)
    owner.call('POST', f'/events/{approval}/registrations/{ra["id"]}/decision', {'decision': 'APPROVE'})
    owner.call('POST', f'/events/{approval}/registrations/{rb["id"]}/decision', {'decision': 'REJECT', 'reason': 'Группа укомплектована'})
    assert a.call('GET', f'/events/{approval}/my-registration')['status'] == 'CONFIRMED'
    assert b.call('GET', f'/events/{approval}/my-registration')['status'] == 'REJECTED'
    print('S4 OK: PENDING, обе ветви решения, запрет решения администратором')

    question = b.call('POST', f'/events/{opened}/comments', {'text': 'Можно без опыта?'}, 201)
    owner.call('POST', f'/events/{opened}/comments', {'text': 'Да, поможем освоиться'}, 201)
    assert a.call('GET', f'/events/{opened}/comments')['total'] == 2
    admin.call('POST', f'/admin/comments/{question["id"]}/hide', {'reason': 'Проверка модерации'})
    assert a.call('GET', f'/events/{opened}/comments')['total'] == 1
    print('S5 OK: вопрос без записи, ответ, скрытие отдельного сообщения')

    b.call('POST', f'/events/{opened}/registrations', {}, 201)
    assert c.call('POST', f'/events/{opened}/waitlist', {}, 201)['status'] == 'WAITLISTED'
    b.call('DELETE', f'/events/{opened}/registrations/me')
    assert c.call('GET', f'/events/{opened}/my-registration')['status'] == 'CONFIRMED'
    print('Очередь OK: автоматическое продвижение, лимит сохранён')

    direct = a.call('POST', '/conversations', {'type': 'DIRECT', 'peerUserId': c.user}, (200, 201))['id']
    assert c.call('POST', '/conversations', {'type': 'DIRECT', 'peerUserId': a.user})['id'] == direct
    a.call('POST', f'/conversations/{direct}/messages', {'text': f'Привет! {label}'}, 201)
    assert c.call('GET', f'/conversations/{direct}/messages')['items'][0]['author']['id'] == a.user
    admin.call('GET', f'/conversations/{direct}/messages', expected=403)
    group = owner.call('POST', '/conversations', {'type': 'COMMUNITY', 'organizationId': org, 'title': f'Клуб {label}'}, 201)['id']
    c.call('POST', f'/organizations/{org}/memberships', expected=201)
    c.call('POST', f'/conversations/{group}/messages', {'text': 'Всем привет!'}, 201)
    assert owner.call('GET', f'/conversations/{group}/messages')['total'] == 1
    c.call('DELETE', f'/organizations/{org}/memberships/me', expected=204)
    c.call('GET', f'/conversations/{group}/messages', expected=403)
    print('Чаты OK: уникальность Direct, приватность, членство и выход из Community')

    admin.call('POST', f'/admin/events/{opened}/unpublish', {'reason': 'Площадка закрыта'})
    assert a.call('GET', f'/events/{opened}')['moderationReason'] == 'Площадка закрыта'
    b.call('POST', f'/events/{opened}/registrations', {}, 409)
    b.call('GET', f'/events/{opened}', expected=200)  # ранее зарегистрированный видит информационную карточку
    assert opened not in [item['id'] for item in public.call('GET', '/events')['items']]
    print('S6 OK: снятие, причина для записанных, запрет прямой регистрации')
    print('HTTP smoke завершён. Созданные демонстрационные данные сохранены.')


if __name__ == '__main__':
    try:
        main()
    except (AssertionError, urllib.error.URLError, OSError, ValueError) as exc:
        print(f'FAILED: {exc}', file=sys.stderr)
        sys.exit(1)

from app.core.security import get_password_hash
from app.models.enums import UserRole
from app.models.institute import Institute
from app.models.user import User


def _seed_admin(db_session):
    institute = Institute(name="Test Institute")
    db_session.add(institute)
    db_session.flush()
    admin = User(
        institute_id=institute.id,
        full_name="Admin",
        email="admin@test.com",
        phone="9000000000",
        password_hash=get_password_hash("Admin@123"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(admin)
    db_session.commit()


def test_auth_login_refresh_and_me(client, db_session):
    _seed_admin(db_session)

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "Admin@123"},
    )
    assert login.status_code == 200
    body = login.json()
    assert body["access_token"]
    assert body["refresh_token"]

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == "admin@test.com"

    refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert refresh.status_code == 200
    assert refresh.json()["access_token"]


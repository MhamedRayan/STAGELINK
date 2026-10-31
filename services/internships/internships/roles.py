class Role:
    STUDENT = "student"
    COMPANY = "company"
    SUPERVISOR = "supervisor"
    UNIVERSITY_ADMIN = "university_admin"
    PLATFORM_ADMIN = "platform_admin"


ALL_ROLES = frozenset({
    Role.STUDENT,
    Role.COMPANY,
    Role.SUPERVISOR,
    Role.UNIVERSITY_ADMIN,
    Role.PLATFORM_ADMIN,
})

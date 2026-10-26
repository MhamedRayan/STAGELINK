class Role:
    STUDENT = "Student"
    COMPANY = "Company"
    SUPERVISOR = "Supervisor"
    UNIVERSITY_ADMINISTRATION = "University Administration"
    PLATFORM_ADMINISTRATOR = "Platform Administrator"


ALL_ROLES = frozenset({
    Role.STUDENT,
    Role.COMPANY,
    Role.SUPERVISOR,
    Role.UNIVERSITY_ADMINISTRATION,
    Role.PLATFORM_ADMINISTRATOR,
})

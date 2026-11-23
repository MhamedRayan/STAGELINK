#!/usr/bin/env python3
"""Create the cross-service half of the STAGELINK demo dataset.

The Identity ``seed_demo`` command owns accounts, profiles and verification
states. This script owns everything after login: offers, applications,
internships, submission versions, evaluations, cancellation requests and
notification read state. It uses **only public HTTP APIs**, never another
service's database and never ``/api/internal/*`` — those calls happen inside
the services as a side effect of the public actions.

Prerequisites: the Compose stack is running and ``seed_demo`` has been run.

Usage::

    python tests/integration/seed_rich_demo.py
    python tests/integration/seed_rich_demo.py --json
    python tests/integration/seed_rich_demo.py --password '...' --domain example.com

Reruns are safe: objects are found by their exact demo titles and rerunning a
decision is skipped when the application has already moved on. A fresh stack
is still the cleanest way to rehearse the full demo (see docs/setup.md).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import zipfile
from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from typing import Any
from urllib.parse import quote
from xml.sax.saxutils import escape

import requests

DEFAULT_SERVICES = {
    "identity": "http://localhost:8001",
    "offers": "http://localhost:8002",
    "applications": "http://localhost:8003",
    "internships": "http://localhost:8004",
    "notifications": "http://localhost:8005",
}
DEFAULT_PASSWORD = "StagelinkDemo!2026"
DEFAULT_DOMAIN = "stagelink.demo"
TIMEOUT = 30


class SeedError(RuntimeError):
    """A public API call failed with an unexpected status."""


def iso_days(days: int) -> str:
    when = datetime.now(timezone.utc) + timedelta(days=days)
    return when.isoformat(timespec="seconds").replace("+00:00", "Z")


def day(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def demo_pdf(text: str) -> bytes:
    """A minimal but structurally valid single-page PDF."""
    content = f"BT /F1 14 Tf 72 720 Td ({text}) Tj ET\n".encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(content)).encode("ascii") + b" >>\nstream\n" + content + b"endstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, obj in enumerate(objects, 1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode("ascii") + obj + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode("ascii")
    out += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        out += f"{offset:010d} 00000 n \n".encode("ascii")
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref}\n%%EOF\n"
    ).encode("ascii")
    return bytes(out)


def demo_docx(text: str) -> bytes:
    """A minimal but structurally valid DOCX (zip with the three required parts)."""
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            "</Types>",
        )
        archive.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
            'Target="word/document.xml"/>'
            "</Relationships>",
        )
        archive.writestr(
            "word/document.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            "<w:body><w:p><w:r><w:t>" + escape(text) + "</w:t></w:r></w:p></w:body></w:document>",
        )
    return buffer.getvalue()


class Api:
    """Thin public-API client with one Bearer token per demo account."""

    def __init__(self, services: dict[str, str], password: str, domain: str) -> None:
        self.services = services
        self.password = password
        self.domain = domain
        self.tokens: dict[str, str] = {}
        self.user_ids: dict[str, str] = {}

    def token(self, local_part: str) -> str:
        if local_part not in self.tokens:
            payload = self.request(
                "identity",
                "POST",
                "/api/auth/login/",
                payload={
                    "email": f"{local_part}@{self.domain}",
                    "password": self.password,
                },
            )
            self.tokens[local_part] = payload["access"]
            self.user_ids[local_part] = payload["user"]["id"]
        return self.tokens[local_part]

    def user_id(self, local_part: str) -> str:
        self.token(local_part)
        return self.user_ids[local_part]

    def request(
        self,
        service: str,
        method: str,
        path: str,
        *,
        as_user: str | None = None,
        payload: dict[str, Any] | None = None,
        files: dict[str, tuple[str, bytes, str]] | None = None,
        expect: tuple[int, ...] = (200, 201, 204),
    ) -> Any:
        headers: dict[str, str] = {}
        if as_user is not None:
            headers["Authorization"] = f"Bearer {self.token(as_user)}"
        url = f"{self.services[service]}{path}"
        response = requests.request(
            method,
            url,
            headers=headers,
            json=None if files is not None else payload,
            files=files,
            timeout=TIMEOUT,
        )
        if response.status_code not in expect:
            raise SeedError(f"{method} {url} -> {response.status_code}: {response.text[:500]}")
        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    def rows(self, service: str, path: str, as_user: str) -> list[dict[str, Any]]:
        result = self.request(service, "GET", path, as_user=as_user)
        rows = result.get("results", []) if isinstance(result, dict) else result
        if not isinstance(rows, list):
            raise SeedError(f"Unexpected list response from {path}")
        return rows

    def detail(self, service: str, path: str, as_user: str) -> dict[str, Any]:
        result: dict[str, Any] = self.request(service, "GET", path, as_user=as_user)
        return result


def ensure_offer(
    api: Api,
    owner: str,
    title: str,
    *,
    deadline_days: int,
    capacity: int,
    target_status: str,
) -> dict[str, Any]:
    """Find an offer by exact title or create it and move it to target_status."""
    path = f"/api/offers/?mine=true&search={quote(title)}&limit=100"
    existing = next((row for row in api.rows("offers", path, owner) if row["title"] == title), None)
    if existing is not None and existing["status"] == target_status:
        return existing

    if existing is None:
        offer: dict[str, Any] = api.request(
            "offers",
            "POST",
            "/api/offers/",
            as_user=owner,
            payload={
                "title": title,
                "description": "Fictional STAGELINK demo opportunity used for the guided walkthrough.",
                "requirements": "Curiosity, teamwork and basic software engineering skills.",
                "location": "Douala, Cameroon (hybrid)",
                "deadline": iso_days(deadline_days),
                "capacity": capacity,
            },
        )
    else:
        offer = existing

    if offer["status"] == "draft" and target_status in {"published", "closed"}:
        offer = api.request("offers", "POST", f"/api/offers/{offer['id']}/publish/", as_user=owner)
    if offer["status"] == "published" and target_status == "closed":
        api.request("offers", "POST", f"/api/offers/{offer['id']}/close/", as_user=owner)
    return api.detail("offers", f"/api/offers/{offer['id']}/", owner)


def ensure_application(api: Api, student: str, offer_id: str) -> dict[str, Any]:
    """One application per (student, offer); reuse it on reruns."""
    rows = api.rows(
        "applications",
        f"/api/applications/?offer_id={offer_id}&limit=100",
        "university",
    )
    student_id = api.user_id(student)
    existing = next((row for row in rows if row["student_user_id"] == student_id), None)
    if existing is not None:
        return existing
    created: dict[str, Any] = api.request(
        "applications",
        "POST",
        "/api/applications/",
        as_user=student,
        payload={
            "offer_id": offer_id,
            "start_date": day(0),
            "end_date": day(42),
        },
    )
    return created


def decide(
    api: Api,
    application: dict[str, Any],
    action: str,
    *,
    actor: str,
    payload: dict[str, Any],
    from_status: str,
) -> dict[str, Any]:
    if application["status"] != from_status:
        return application
    updated: dict[str, Any] = api.request(
        "applications",
        "POST",
        f"/api/applications/{application['id']}/{action}/",
        as_user=actor,
        payload=payload,
    )
    return updated


def company_accept(api: Api, application: dict[str, Any], actor: str) -> dict[str, Any]:
    return decide(
        api, application, "company-decision", actor=actor,
        payload={"decision": "ACCEPT"}, from_status="SUBMITTED",
    )


def university_accept(api: Api, application: dict[str, Any]) -> dict[str, Any]:
    return decide(
        api, application, "university-decision", actor="university",
        payload={"decision": "ACCEPT"}, from_status="COMPANY_ACCEPTED",
    )


def student_accept(api: Api, application: dict[str, Any], student: str) -> dict[str, Any]:
    return decide(
        api, application, "student-decision", actor=student,
        payload={"decision": "ACCEPT"}, from_status="UNIVERSITY_VALIDATED",
    )


def confirm(
    api: Api,
    student: str,
    company: str,
    offer_id: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Drive one application through all three decisions to CONFIRMED."""
    application = ensure_application(api, student, offer_id)
    application = company_accept(api, application, company)
    application = university_accept(api, application)
    application = student_accept(api, application, student)
    internship = find_internship(api, student, application["id"])
    if internship is None:
        raise SeedError(f"No internship was created for application {application['id']}")
    return application, internship


def find_internship(api: Api, student: str, application_id: str) -> dict[str, Any] | None:
    rows = api.rows(
        "internships",
        f"/api/internships/?student_user_id={api.user_id(student)}&limit=100",
        "university",
    )
    return next((row for row in rows if row["source_application_id"] == application_id), None)


def refresh_internship(api: Api, internship_id: str) -> dict[str, Any]:
    return api.detail("internships", f"/api/internships/{internship_id}/", "university")


def assign_supervisor(api: Api, internship_id: str, supervisor: str) -> dict[str, Any]:
    internship = refresh_internship(api, internship_id)
    if internship["supervisor_user_id"] is None:
        api.request(
            "internships",
            "POST",
            f"/api/internships/{internship_id}/assign-supervisor/",
            as_user="university",
            payload={"supervisor_user_id": api.user_id(supervisor)},
        )
    return refresh_internship(api, internship_id)


def start_internship(api: Api, internship_id: str) -> dict[str, Any]:
    internship = refresh_internship(api, internship_id)
    if internship["status"] == "confirmed":
        api.request(
            "internships",
            "POST",
            f"/api/internships/{internship_id}/start/",
            as_user="university",
        )
    return refresh_internship(api, internship_id)


def upload_submission(
    api: Api,
    internship_id: str,
    student: str,
    version: int,
    filename: str,
    content: bytes,
    content_type: str,
) -> dict[str, Any]:
    rows = api.rows(
        "internships",
        f"/api/internships/{internship_id}/submissions/",
        student,
    )
    existing = next((row for row in rows if row["version"] == version), None)
    if existing is not None:
        return existing
    created: dict[str, Any] = api.request(
        "internships",
        "POST",
        f"/api/internships/{internship_id}/submissions/",
        as_user=student,
        files={"file": (filename, content, content_type)},
    )
    return created


def review_submission(
    api: Api,
    internship_id: str,
    submission: dict[str, Any],
    supervisor: str,
    action: str,
    reason: str,
) -> dict[str, Any]:
    if submission["status"] != "SUBMITTED":
        return submission
    updated: dict[str, Any] = api.request(
        "internships",
        "POST",
        f"/api/internships/{internship_id}/submissions/{submission['id']}/{action}/",
        as_user=supervisor,
        payload={"reason": reason},
    )
    return updated


def record_evaluation(api: Api, internship_id: str, supervisor: str) -> None:
    internship = refresh_internship(api, internship_id)
    if internship["status"] == "completed":
        return
    existing = api.request(
        "internships",
        "GET",
        f"/api/internships/{internship_id}/evaluation/",
        as_user=supervisor,
        expect=(200, 404),
    )
    if isinstance(existing, dict) and existing.get("id"):
        return
    api.request(
        "internships",
        "POST",
        f"/api/internships/{internship_id}/evaluation/",
        as_user=supervisor,
        payload={
            "grade": "17.50",
            "comment": "Excellent final report and presentation.",
        },
    )


def request_cancellation(
    api: Api,
    internship_id: str,
    actor: str,
    role: str,
    reason: str,
) -> dict[str, Any]:
    rows = api.rows(
        "internships",
        f"/api/internships/{internship_id}/cancellation-requests/",
        actor,
    )
    pending = next(
        (
            row for row in rows
            if row["status"] == "pending" and row["requested_by_role"] == role
        ),
        None,
    )
    if pending is not None:
        return pending
    # A decided request is also a valid completed demo state. Reusing it keeps
    # reruns safe after the internship itself has been cancelled.
    decided = next((row for row in rows if row["requested_by_role"] == role), None)
    if decided is not None:
        return decided
    created: dict[str, Any] = api.request(
        "internships",
        "POST",
        f"/api/internships/{internship_id}/cancellation-requests/",
        as_user=actor,
        payload={"reason": reason},
    )
    return created


def decide_cancellation(
    api: Api,
    internship_id: str,
    request_id: str,
    action: str,
    reason: str | None = None,
) -> dict[str, Any]:
    payload = {"reason": reason} if reason is not None else {}
    updated: dict[str, Any] = api.request(
        "internships",
        "POST",
        f"/api/internships/{internship_id}/cancellation-requests/{request_id}/{action}/",
        as_user="university",
        payload=payload,
    )
    return updated


def cancellation_status(api: Api, internship_id: str, request_id: str, actor: str) -> str:
    rows = api.rows(
        "internships",
        f"/api/internships/{internship_id}/cancellation-requests/",
        actor,
    )
    row = next((row for row in rows if row["id"] == request_id), None)
    return row["status"] if row else "unknown"


def sample_notifications(api: Api, local_part: str, *, read_all: bool = False) -> dict[str, Any]:
    count = api.request(
        "notifications",
        "GET",
        "/api/notifications/unread-count/",
        as_user=local_part,
    )
    unread = api.rows(
        "notifications",
        "/api/notifications/?unread=true&limit=100",
        local_part,
    )
    marked = 0
    if read_all and len(unread) > 1:
        result = api.request(
            "notifications",
            "POST",
            "/api/notifications/read-all/",
            as_user=local_part,
        )
        marked = result["marked_read"] if result else 0
    elif len(unread) > 1:
        api.request(
            "notifications",
            "PATCH",
            f"/api/notifications/{unread[0]['id']}/read/",
            as_user=local_part,
        )
        marked = 1
    return {
        "unread_before": count["unread_count"],
        "unread_examples": len(unread),
        "marked_read": marked,
    }


def seed(api: Api) -> dict[str, Any]:
    summary: dict[str, Any] = {"offers": {}, "applications": {}, "internships": {}, "notifications": {}}

    # Six live listings across three active companies.
    offers = {
        "main": ensure_offer(
            api, "company", "Demo Backend Internship",
            deadline_days=45, capacity=3, target_status="published",
        ),
        "second": ensure_offer(
            api, "abc-company", "Demo Frontend Internship",
            deadline_days=60, capacity=2, target_status="published",
        ),
        "third": ensure_offer(
            api, "eurl-farissia", "Demo Data Internship",
            deadline_days=75, capacity=1, target_status="published",
        ),
        "draft": ensure_offer(
            api, "company", "Demo Draft Internship",
            deadline_days=90, capacity=2, target_status="draft",
        ),
        "closed": ensure_offer(
            api, "company", "Demo Closed Internship",
            deadline_days=100, capacity=2, target_status="closed",
        ),
        "near": ensure_offer(
            api, "abc-company", "Demo Near-Deadline Internship",
            deadline_days=2, capacity=2, target_status="published",
        ),
    }
    summary["offers"] = {key: row["status"] for key, row in offers.items()}
    main_id = offers["main"]["id"]
    second_id = offers["second"]["id"]
    third_id = offers["third"]["id"]
    near_id = offers["near"]["id"]

    # Completed placement: rejected v1, approved v2, evaluation 17.50.
    completed_app, completed_internship = confirm(api, "student", "company", main_id)
    completed_internship = assign_supervisor(api, completed_internship["id"], "supervisor")
    completed_internship = start_internship(api, completed_internship["id"])
    version_one = upload_submission(
        api, completed_internship["id"], "student", 1,
        "final-report-v1.pdf",
        demo_pdf("STAGELINK final report - version 1"),
        "application/pdf",
    )
    version_one = review_submission(
        api, completed_internship["id"], version_one, "supervisor",
        "reject", "Please add the deployment appendix.",
    )
    version_two = upload_submission(
        api, completed_internship["id"], "student", 2,
        "final-report-v2.docx",
        demo_docx("STAGELINK final report - version 2, with deployment appendix"),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    version_two = review_submission(
        api, completed_internship["id"], version_two, "supervisor",
        "approve", "Appendix added; approved.",
    )
    record_evaluation(api, completed_internship["id"], "supervisor")
    summary["internships"]["completed"] = refresh_internship(api, completed_internship["id"])["status"]
    summary["submissions"] = [version_one["status"], version_two["status"]]

    # Rejection variants. student-3's university rejection frees a place on the
    # second offer; student-4's company rejection never reserves one.
    rejected_app = ensure_application(api, "student-3", second_id)
    rejected_app = company_accept(api, rejected_app, "abc-company")
    if rejected_app["status"] == "COMPANY_ACCEPTED":
        rejected_app = decide(
            api, rejected_app, "university-decision", actor="university",
            payload={"decision": "REJECT", "reason": "Academic prerequisites are missing."},
            from_status="COMPANY_ACCEPTED",
        )

    company_rejected_app = ensure_application(api, "student-4", second_id)
    company_rejected_app = decide(
        api, company_rejected_app, "company-decision", actor="abc-company",
        payload={"decision": "REJECT", "reason": "Role filled by a stronger match."},
        from_status="SUBMITTED",
    )

    # Confirmed placement with a rejected-then-approved cancellation request.
    cancelled_app, cancelled_internship = confirm(api, "student-2", "abc-company", second_id)
    first_request = request_cancellation(
        api, cancelled_internship["id"], "abc-company", "company", "Company restructuring."
    )
    if first_request["status"] == "pending":
        first_request = decide_cancellation(
            api, cancelled_internship["id"], first_request["id"], "reject",
            "Please continue the planned onboarding.",
        )
    second_request = request_cancellation(
        api, cancelled_internship["id"], "student-2", "student", "Personal circumstances."
    )
    if second_request["status"] == "pending":
        second_request = decide_cancellation(
            api, cancelled_internship["id"], second_request["id"], "approve"
        )
    summary["internships"]["cancelled"] = refresh_internship(api, cancelled_internship["id"])["status"]

    # Two live applications for student-5; confirming one withdraws the other.
    live_one = ensure_application(api, "student-5", second_id)
    live_two = ensure_application(api, "student-5", third_id)
    confirmed_app, unassigned_internship = confirm(api, "student-5", "abc-company", second_id)
    summary["applications"]["withdrawn"] = refresh_application(api, live_two["id"])["status"]
    pending_request = request_cancellation(
        api, unassigned_internship["id"], "student-5", "student", "Family obligations."
    )
    summary["internships"]["confirmed_unassigned"] = refresh_internship(api, unassigned_internship["id"])["status"]
    summary["cancellation_requests"] = {
        "rejected": cancellation_status(
            api, cancelled_internship["id"], first_request["id"], "abc-company"
        ),
        "approved": cancellation_status(
            api, cancelled_internship["id"], second_request["id"], "student-2"
        ),
        "pending": cancellation_status(
            api, unassigned_internship["id"], pending_request["id"], "student-5"
        ),
    }

    # Remaining application statuses: COMPANY_ACCEPTED, UNIVERSITY_VALIDATED,
    # STUDENT_DECLINED and a plain SUBMITTED, all without a second internship.
    accepted_app = ensure_application(api, "student-3", main_id)
    accepted_app = company_accept(api, accepted_app, "company")
    validated_app = ensure_application(api, "student", near_id)
    validated_app = company_accept(api, validated_app, "abc-company")
    validated_app = university_accept(api, validated_app)
    declined_app = ensure_application(api, "student-4", main_id)
    declined_app = company_accept(api, declined_app, "company")
    declined_app = university_accept(api, declined_app)
    declined_app = decide(
        api, declined_app, "student-decision", actor="student-4",
        payload={"decision": "DECLINE"}, from_status="UNIVERSITY_VALIDATED",
    )
    submitted_app = ensure_application(api, "student-3", near_id)
    summary["applications"]["statuses"] = {
        "completed": completed_app["status"],
        "company_rejected": company_rejected_app["status"],
        "university_rejected": rejected_app["status"],
        "withdrawn": summary["applications"]["withdrawn"],
        "company_accepted": accepted_app["status"],
        "university_validated": validated_app["status"],
        "student_declined": declined_app["status"],
        "submitted": submitted_app["status"],
    }

    # In-progress placement with an assigned supervisor and a pending submission.
    progress_app, progress_internship = confirm(api, "student-4", "eurl-farissia", third_id)
    progress_internship = assign_supervisor(api, progress_internship["id"], "supervisor-2")
    progress_internship = start_internship(api, progress_internship["id"])
    pending_submission = upload_submission(
        api, progress_internship["id"], "student-4", 1,
        "progress-report.pdf",
        demo_pdf("STAGELINK in-progress report"),
        "application/pdf",
    )
    summary["internships"]["in_progress"] = refresh_internship(api, progress_internship["id"])["status"]
    summary["progress_submission"] = pending_submission["status"]

    # One read and several unread examples per role that receives notifications.
    for local_part in ("student", "student-2", "student-5", "company", "abc-company", "university", "supervisor", "supervisor-2"):
        summary["notifications"][local_part] = sample_notifications(api, local_part)
    summary["notifications"]["student-3"] = sample_notifications(api, "student-3", read_all=True)

    return summary


def refresh_application(api: Api, application_id: str) -> dict[str, Any]:
    return api.detail("applications", f"/api/applications/{application_id}/", "university")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--password", default=os.environ.get("DEMO_PASSWORD", DEFAULT_PASSWORD))
    parser.add_argument("--domain", default=os.environ.get("DEMO_DOMAIN", DEFAULT_DOMAIN))
    parser.add_argument("--json", action="store_true", help="Print a machine-readable summary")
    for service, default in DEFAULT_SERVICES.items():
        env_name = f"{service.upper()}_BASE_URL"
        parser.add_argument(
            f"--{service}-url",
            default=os.environ.get(env_name, default),
            help=f"{service} public base URL (env: {env_name})",
        )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    services = {service: getattr(args, f"{service}_url") for service in DEFAULT_SERVICES}
    api = Api(services, args.password, args.domain)
    try:
        summary = seed(api)
    except (SeedError, requests.RequestException, KeyError) as error:
        print(f"Rich demo seed failed: {error}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print("Rich demo seed complete.")
        for section in ("offers", "applications", "internships", "submissions", "cancellation_requests", "notifications"):
            print(f"  {section}: {json.dumps(summary[section])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

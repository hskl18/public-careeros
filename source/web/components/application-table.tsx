"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Application } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui";

const stages = ["all", "Applied", "Assessment", "Interviewing", "Offer", "Rejected", "Watching"];

export function ApplicationTable({ applications }: { applications: Application[] }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [flag, setFlag] = useState("all");

  const filtered = useMemo(
    () =>
      applications.filter((application) => {
        const matchesStage = stage === "all" || application.stage === stage;
        const haystack = `${application.company} ${application.role}`.toLowerCase();
        const matchesQuery = haystack.includes(query.trim().toLowerCase());
        const matchesFlag =
          flag === "all" ||
          (flag === "needs-action" && application.actionRequired) ||
          (flag === "review" && application.reviewStatus !== "clear") ||
          (flag === "due" && Boolean(application.deadline)) ||
          (flag === "recruiter-reply" && application.recruiterReply) ||
          (flag === "missing-evidence" && application.missingEvidence);

        return matchesStage && matchesQuery && matchesFlag;
      }),
    [applications, flag, query, stage],
  );

  return (
    <div className="section">
      <div className="toolbar" aria-label="Application filters">
        <label className="control" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Search company or role</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company or role"
            style={{ border: 0, outline: 0, background: "transparent", minWidth: 210 }}
          />
        </label>
        <select
          className="control"
          value={stage}
          onChange={(event) => setStage(event.target.value)}
          aria-label="Filter by stage"
        >
          {stages.map((item) => (
            <option key={item} value={item}>
              {item === "all" ? "All stages" : item}
            </option>
          ))}
        </select>
        <select
          className="control"
          value={flag}
          onChange={(event) => setFlag(event.target.value)}
          aria-label="Filter by state"
        >
          <option value="all">All states</option>
          <option value="needs-action">Needs action</option>
          <option value="review">In review</option>
          <option value="due">Due soon or overdue</option>
          <option value="recruiter-reply">Recruiter reply</option>
          <option value="missing-evidence">Missing evidence</option>
        </select>
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Company / role</th>
              <th>Stage</th>
              <th>Deadline</th>
              <th>Latest evidence</th>
              <th>Next action</th>
              <th>Review</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((application) => {
              const latestEvidence = application.evidence[0];
              return (
                <tr key={application.id}>
                  <td>
                    <Link href={`/applications/${application.id}`}>
                      <strong>{application.company}</strong>
                      <p className="small muted">{application.role}</p>
                    </Link>
                    <div className="toolbar" style={{ marginTop: 8 }}>
                      <StatusPill>{application.priority}</StatusPill>
                      {application.recruiterReply ? <StatusPill tone="info">reply</StatusPill> : null}
                    </div>
                  </td>
                  <td>
                    <StatusPill tone={application.reviewStatus === "blocked" ? "warn" : "info"}>
                      {application.stage}
                    </StatusPill>
                    <p className="small muted" style={{ marginTop: 8 }}>
                      Last {formatDateTime(application.lastActivity)}
                    </p>
                  </td>
                  <td>
                    {application.deadline ? (
                      <StatusPill tone="warn">{formatDateTime(application.deadline)}</StatusPill>
                    ) : (
                      <span className="small muted">No deadline</span>
                    )}
                  </td>
                  <td>
                    <strong>{latestEvidence?.title ?? "No evidence"}</strong>
                    <p className="small muted">
                      {latestEvidence?.source ?? "Create manual evidence or import JSON"}
                    </p>
                  </td>
                  <td>
                    {application.nextAction}
                    <div className="toolbar" style={{ marginTop: 8 }}>
                      {application.actionRequired ? <StatusPill tone="warn">needs action</StatusPill> : null}
                      {application.missingEvidence ? <StatusPill tone="danger">missing evidence</StatusPill> : null}
                    </div>
                  </td>
                  <td>
                    <StatusPill tone={application.reviewStatus === "clear" ? "good" : "warn"}>
                      {application.reviewStatus}
                    </StatusPill>
                  </td>
                  <td>{application.source}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="list">
        {filtered.map((application) => (
          <Link key={application.id} href={`/applications/${application.id}`} className="row-card mobile-row">
            <div className="row-top">
              <div>
                <h3>{application.company}</h3>
                <p className="small muted">{application.role}</p>
              </div>
              <StatusPill tone={application.reviewStatus === "blocked" ? "warn" : "info"}>
                {application.stage}
              </StatusPill>
            </div>
            <p className="small muted">{application.nextAction}</p>
            <div className="toolbar">
              <StatusPill>{application.source}</StatusPill>
              <StatusPill>{application.evidenceCount} evidence</StatusPill>
              <StatusPill tone={application.reviewStatus === "clear" ? "good" : "warn"}>
                {application.reviewStatus}
              </StatusPill>
              {application.deadline ? <StatusPill tone="warn">{formatDateTime(application.deadline)}</StatusPill> : null}
              {application.actionRequired ? <StatusPill tone="warn">needs action</StatusPill> : null}
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="row-card">
          <h3>No matching applications</h3>
          <p className="small muted">
            Clear filters, create a manual application, load seeded demo data, or import local JSON.
            Gmail stays optional.
          </p>
        </div>
      ) : null}
    </div>
  );
}

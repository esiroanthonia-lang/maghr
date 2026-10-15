"use client";

import { useState, useTransition } from "react";
import { changeRole, decideManagerAccessRequest, inviteMember, removeMember, revokeInvite } from "@/app/actions/team";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/workspace";
import { Avatar, Badge, Notice, Panel, RelativeTime } from "../ui/bits";
import { useToast } from "../ui/Toast";

export interface Member {
  userId: string;
  name: string;
  email: string;
  role: Role;
}
export interface ManagerAccessRequest {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  requestedAt: string;
  directReports: number;
}
export interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
}

const ROLE_HELP: Record<Role, string> = {
  hr_admin: "Everything, including team, settings and audit log",
  recruiter: "Jobs, candidates, interviews and offers",
  manager: "Review performance for assigned direct reports",
  employee: "Their own record (self-service coming next)",
};

export function TeamManager({ members, invites, managerRequests, meId, isAdmin }: { members: Member[]; invites: PendingInvite[]; managerRequests: ManagerAccessRequest[]; meId: string; isAdmin: boolean }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("recruiter");
  const [link, setLink] = useState<string | null>(null);

  function run(p: Promise<{ ok: boolean; error?: string; link?: string }>, success: string) {
    start(async () => {
      const r = await p;
      if (!r.ok) toast(r.error ?? "Something went wrong.");
      else {
        toast(success);
        if (r.link) setLink(r.link);
      }
    });
  }

  return (
    <>
      {isAdmin ? (
        <Panel title="Invite a teammate" subtitle="They’ll join with the role you choose. Links expire after 14 days.">
          <form
            className="panel-body invite-form"
            onSubmit={(e) => {
              e.preventDefault();
              setLink(null);
              run(inviteMember(email, role), `Invitation created for ${email}.`);
              setEmail("");
            }}
          >
            <div className="field">
              <label htmlFor="inv-email">Email</label>
              <input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
            </div>
            <div className="field">
              <label htmlFor="inv-role">Role</label>
              <select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <span className="hint">{ROLE_HELP[role]}</span>
            </div>
            <div>
              <button className="btn primary" disabled={busy}>
                Create invitation link
              </button>
            </div>
          </form>
          {link ? (
            <div className="panel-body" style={{ paddingTop: 0 }}>
              <Notice>
                Send this link to them (it isn’t emailed automatically yet):{" "}
                <code className="invite-link">{link}</code>{" "}
                <button type="button" className="link-btn" onClick={() => navigator.clipboard?.writeText(link).then(() => toast("Link copied."))}>
                  Copy
                </button>
              </Notice>
            </div>
          ) : null}
        </Panel>
      ) : (
        <Notice>Only HR admins can invite people or change roles.</Notice>
      )}

      {isAdmin ? <Panel title="Manager access requests" subtitle="Approve access only for people with direct reports assigned to their profile.">
        {managerRequests.length ? <ul className="list">{managerRequests.map((request) => <li key={request.id} className="list-row">
          <Avatar name={request.name || request.email} />
          <div className="person-info"><strong>{request.name || request.email}</strong><span>{request.email} · {request.directReports} direct {request.directReports === 1 ? "report" : "reports"} · requested <RelativeTime iso={request.requestedAt} /></span></div>
          <div className="button-row"><button type="button" className="btn small primary" disabled={busy} onClick={() => run(decideManagerAccessRequest(request.id, true), "Manager performance access approved.")}>Approve</button><button type="button" className="btn small" disabled={busy} onClick={() => run(decideManagerAccessRequest(request.id, false), "Manager access request declined.")}>Decline</button></div>
        </li>)}</ul> : <p className="panel-body" style={{ margin: 0 }}>No pending manager access requests.</p>}
      </Panel> : null}

      <Panel title="Team" subtitle={`${members.length} ${members.length === 1 ? "person" : "people"} in this workspace`}>
        <ul className="list">
          {members.map((m) => (
            <li key={m.userId} className="list-row">
              <Avatar name={m.name || m.email} />
              <div className="person-info">
                <strong>
                  {m.name || m.email} {m.userId === meId ? <Badge tone="info">You</Badge> : null}
                </strong>
                <span>{m.email}</span>
              </div>
              {isAdmin && m.userId !== meId ? (
                <div className="button-row">
                  <label className="sr-only" htmlFor={`role-${m.userId}`}>
                    Role for {m.name || m.email}
                  </label>
                  <select id={`role-${m.userId}`} className="control" value={m.role} disabled={busy} onChange={(e) => run(changeRole(m.userId, e.target.value as Role), "Role updated.")}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn small danger"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Remove ${m.name || m.email} from this workspace?`)) run(removeMember(m.userId), "Removed from workspace.");
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <Badge tone="neutral">{ROLE_LABELS[m.role]}</Badge>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {isAdmin && invites.length ? (
        <Panel title="Pending invitations">
          <ul className="list">
            {invites.map((i) => (
              <li key={i.id} className="list-row">
                <div className="person-info">
                  <strong>{i.email}</strong>
                  <span>
                    {ROLE_LABELS[i.role]} · sent <RelativeTime iso={i.createdAt} />
                  </span>
                </div>
                <button type="button" className="btn small" disabled={busy} onClick={() => run(revokeInvite(i.id), "Invitation revoked.")}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}

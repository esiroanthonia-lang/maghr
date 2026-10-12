"use client";

import type { ReactNode } from "react";
import { isClosedStage, stageIndex } from "@/lib/recruitment";
import { useDemoStore } from "@/lib/store";
import { CandidateDrawer } from "../recruitment/CandidateDrawer";
import { CandidateForm } from "../recruitment/CandidateForm";
import { ConvertForm } from "../recruitment/ConvertForm";
import { InterviewForm } from "../recruitment/InterviewForm";
import { JobForm } from "../recruitment/JobForm";
import { PublishForm } from "../recruitment/PublishForm";
import { SourceForm } from "../recruitment/SourceForm";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { useUi } from "./UiContext";

/** Renders whichever dialog or profile drawer is open, on top of any page. */
export function DialogHost() {
  const { state, act } = useDemoStore();
  const { dialog, closeDialog, profileId, openProfile } = useUi();
  const toast = useToast();

  let modal: ReactNode = null;
  if (dialog?.type === "job") {
    modal = (
      <Modal title="Create a job opening" onClose={closeDialog}>
        <JobForm
          onCancel={closeDialog}
          onSubmit={(input) => {
            act({ type: "job/add", input });
            closeDialog();
            toast(
              input.status === "Draft"
                ? `Draft saved: ${input.title.trim()}.`
                : `${input.title.trim()} is open. Publishing to MyJobMag needs an approved integration.`,
            );
          }}
        />
      </Modal>
    );
  } else if (dialog?.type === "candidate") {
    modal = (
      <Modal title="Add a candidate" onClose={closeDialog}>
        <CandidateForm
          jobs={state.jobs}
          defaultJobId={dialog.jobId}
          onCancel={closeDialog}
          onSubmit={(input) => {
            const id = act({ type: "candidate/add", input });
            closeDialog();
            toast(`${input.name.trim()} added to the demo workspace.`);
            openProfile(id);
          }}
        />
      </Modal>
    );
  } else if (dialog?.type === "interview") {
    const c = state.candidates.find((x) => x.id === dialog.candidateId);
    if (c) {
      modal = (
        <Modal title={`Schedule interview · ${c.name}`} onClose={closeDialog}>
          <InterviewForm
            candidateName={c.name}
            canMoveStage={!isClosedStage(c.stage) && stageIndex(c.stage) < stageIndex("Interview")}
            onCancel={closeDialog}
            onSubmit={(input) => {
              act({ type: "candidate/scheduleInterview", candidateId: c.id, input });
              closeDialog();
              toast(`Interview scheduled with ${c.name}. No invite was sent (demo).`);
            }}
          />
        </Modal>
      );
    }
  } else if (dialog?.type === "convert") {
    const c = state.candidates.find((x) => x.id === dialog.candidateId);
    if (c) {
      const job = c.jobId ? state.jobs.find((j) => j.id === c.jobId) ?? null : null;
      modal = (
        <Modal title="Convert to employee" onClose={closeDialog}>
          <ConvertForm
            candidate={c}
            job={job}
            onCancel={closeDialog}
            onSubmit={(input) => {
              act({ type: "candidate/convertToEmployee", candidateId: c.id, input });
              closeDialog();
              toast(`${c.name} added to the demo employee directory as Onboarding.`);
            }}
          />
        </Modal>
      );
    }
  }

  if (dialog?.type === "publish") {
    const job = state.jobs.find((j) => j.id === dialog.jobId);
    if (job) {
      modal = (
        <Modal title="Publish vacancy" onClose={closeDialog}>
          <PublishForm
            job={job}
            onCancel={closeDialog}
            onSubmit={(channels) => {
              act({ type: "job/publish", jobId: job.id, channels });
              closeDialog();
              toast(channels.length ? `${job.title} advertised on ${channels.join(", ")} (demo).` : `All adverts for ${job.title} taken down.`);
            }}
          />
        </Modal>
      );
    }
  } else if (dialog?.type === "source") {
    const profile = state.talentDb.find((p) => p.id === dialog.profileId);
    if (profile) {
      modal = (
        <Modal title={`Source ${profile.name}`} onClose={closeDialog}>
          <SourceForm
            profile={profile}
            jobs={state.jobs.filter((j) => j.status === "Open")}
            invitedJobIds={state.invitations.filter((i) => i.profileId === profile.id).map((i) => i.jobId)}
            pipelineJobIds={state.candidates.filter((c) => c.sourcedProfileId === profile.id).map((c) => c.jobId ?? "")}
            onCancel={closeDialog}
            onInvite={(jobId) => {
              act({ type: "talent/invite", profileId: profile.id, jobId });
              closeDialog();
              toast(`Invitation to apply recorded for ${profile.name}. No message was sent (demo).`);
            }}
            onAdd={(jobId) => {
              const id = act({ type: "talent/addToPipeline", profileId: profile.id, jobId });
              closeDialog();
              toast(`${profile.name} added to the pipeline at Applied.`);
              openProfile(id);
            }}
          />
        </Modal>
      );
    }
  }

  return (
    <>
      {profileId ? <CandidateDrawer key={profileId} candidateId={profileId} /> : null}
      {modal}
    </>
  );
}

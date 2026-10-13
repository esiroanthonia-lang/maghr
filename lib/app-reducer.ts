// One reducer for the whole app: recruitment + people modules share a single state object.

import { isPeopleAction, peopleReducer, type PeopleAction } from "./people";
import { recruitmentReducer, type RecruitmentAction, type RecruitmentState } from "./recruitment";

export type AppAction = RecruitmentAction | PeopleAction;
export type AppState = RecruitmentState;

export function appReducer(state: AppState, action: AppAction): AppState {
  if (action.type === "reset") return action.state;
  if (isPeopleAction(action.type)) return peopleReducer(state, action as PeopleAction);
  return recruitmentReducer(state, action as RecruitmentAction);
}

/** Why an action does not apply to the session and view now; undefined when it does. */
export type Reason<Session, View> = (session: Session, view: View) => string | undefined;

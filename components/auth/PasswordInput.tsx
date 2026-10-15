"use client";

import { useState, type InputHTMLAttributes } from "react";

/** A password field with a Show / Hide button, so people can check what they typed. */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-field">
      <input {...props} type={show ? "text" : "password"} />
      <button type="button" className="password-toggle" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? "Hide password" : "Show password"} aria-controls={props.id}>
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}

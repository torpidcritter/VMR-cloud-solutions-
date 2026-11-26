"use client";

import { resetUserMfaAction } from "../../../actions/security";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/forms";
import { ROLE_LABELS, ROLES } from "@/lib/auth/permissions";
import { resetPasswordAction, updateUserAction } from "../../../actions/users";
import { setTargetAction } from "../../../actions/interviews";

export function UserForm({ user, self }: { user: { id: string; name: string; role: string; active: boolean }; self: boolean }) {
  return (
    <ActionForm action={updateUserAction} className="grid gap-4 sm:grid-cols-2">
      {(state) => (
        <>
          <input type="hidden" name="id" value={user.id} />
          <div>
            <label htmlFor="name" className="a-label">
              Name
            </label>
            <input id="name" name="name" defaultValue={user.name} aria-invalid={!!state.errors?.name} className="a-field" />
            <FieldError error={state.errors?.name} />
          </div>
          <div>
            <label htmlFor="role" className="a-label">
              Role
            </label>
            <select id="role" name="role" defaultValue={user.role} className="a-field">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <FieldError error={state.errors?.role} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="active" defaultChecked={user.active} className="size-4 accent-[var(--color-btn)]" />
            Active (can sign in){self && <span className="text-muted"> · this is your own account</span>}
          </label>
          <div className="sm:col-span-2">
            <SubmitButton>Save</SubmitButton>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  return (
    <ActionForm action={resetPasswordAction}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="a-btn" pendingLabel="Resetting…">
        Reset password
      </SubmitButton>
    </ActionForm>
  );
}

export function ResetMfaForm({ id, name }: { id: string; name: string }) {
  return (
    <ActionForm action={resetUserMfaAction}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="a-btn" pendingLabel="Switching off…">
        Switch off two-step sign-in for {name}
      </SubmitButton>
    </ActionForm>
  );
}

export function TargetForm({ userId, target }: { userId: string; target: number | null }) {
  return (
    <ActionForm action={setTargetAction} className="flex flex-wrap items-end gap-3">
      {(state) => (
        <>
          <input type="hidden" name="userId" value={userId} />
          <div>
            <label htmlFor="placements" className="a-label">
              Placements
            </label>
            <input
              id="placements"
              name="placements"
              type="number"
              min={0}
              max={999}
              inputMode="numeric"
              defaultValue={target ?? ""}
              className="a-field w-32"
              aria-invalid={!!state.errors?.placements}
              aria-describedby={state.errors?.placements ? "placements-error" : undefined}
            />
            <FieldError id="placements-error" error={state.errors?.placements} />
          </div>
          <SubmitButton>Save target</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

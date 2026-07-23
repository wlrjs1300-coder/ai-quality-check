"use client";

import { useEffect, useRef, useState } from "react";

import { type FieldErrors, toApiError } from "@/src/lib/api/errors";
import { createProject, type Project } from "@/src/lib/api/projects";

type ProjectCreateFormProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => Promise<void>;
};

type FormValues = {
  name: string;
  slug: string;
  description: string;
};

const EMPTY_FORM: FormValues = { name: "", slug: "", description: "" };

function clientErrors(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name.trim()) errors.name = ["이름을 입력해 주세요."];
  if (!values.slug.trim()) errors.slug = ["slug를 입력해 주세요."];
  if (values.name.length > 120) errors.name = ["이름은 120자 이하여야 합니다."];
  if (values.slug.length > 120) errors.slug = ["slug는 120자 이하여야 합니다."];
  return errors;
}

export function ProjectCreateForm({ open, onClose, onCreated }: ProjectCreateFormProps) {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      const controller = requestRef.current;
      requestRef.current = null;
      controller?.abort();
    },
    [],
  );

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const validation = clientErrors(values);
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const result = await createProject(
        {
          name: values.name.trim(),
          slug: values.slug.trim(),
          description: values.description.trim() || null,
        },
        controller.signal,
      );
      setValues(EMPTY_FORM);
      await onCreated(result.data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const apiError = toApiError(error);
      if (apiError.kind === "validation") {
        setFieldErrors(apiError.fieldErrors);
      } else if (apiError.code === "DUPLICATE_SLUG") {
        setFieldErrors({ slug: ["이미 사용 중인 slug입니다."] });
      } else {
        setFormError(apiError.message);
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setSubmitting(false);
      }
    }
  }

  function update(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: [] }));
  }

  return (
    <section className="form-panel" aria-labelledby="create-project-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">New project</p>
          <h2 id="create-project-title">Project 생성</h2>
        </div>
        <button className="text-button" type="button" onClick={onClose} disabled={submitting}>
          닫기
        </button>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <label>
            <span>이름</span>
            <input
              name="name"
              value={values.name}
              maxLength={120}
              onChange={(event) => update("name", event.target.value)}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.name?.length)}
              aria-describedby="name-error"
            />
            <span className="field-error" id="name-error">{fieldErrors.name?.[0]}</span>
          </label>
          <label>
            <span>Slug</span>
            <input
              name="slug"
              value={values.slug}
              maxLength={120}
              onChange={(event) => update("slug", event.target.value)}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.slug?.length)}
              aria-describedby="slug-error"
            />
            <span className="field-error" id="slug-error">{fieldErrors.slug?.[0]}</span>
          </label>
        </div>
        <label>
          <span>설명 <small>선택</small></span>
          <textarea
            name="description"
            rows={3}
            value={values.description}
            onChange={(event) => update("description", event.target.value)}
            disabled={submitting}
            aria-describedby="description-error"
          />
          <span className="field-error" id="description-error">{fieldErrors.description?.[0]}</span>
        </label>
        {formError ? <p className="form-error" role="alert">{formError}</p> : null}
        <div className="form-actions">
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "생성 중…" : "Project 생성"}
          </button>
        </div>
      </form>
    </section>
  );
}

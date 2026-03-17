import { useState, useCallback } from 'react';

type ValidationRules<T> = {
  [K in keyof T]?: (value: T[K], formData: T) => string | null;
};

export function useFormValidation<T extends Record<string, any>>(
  rules: ValidationRules<T>
) {
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const validate = useCallback(
    (formData: T): boolean => {
      const newErrors: Partial<Record<keyof T, string>> = {};
      let isValid = true;

      for (const field in rules) {
        const rule = rules[field];
        if (rule) {
          const error = rule(formData[field], formData);
          if (error) {
            newErrors[field] = error;
            isValid = false;
          }
        }
      }

      setErrors(newErrors);
      return isValid;
    },
    [rules]
  );

  const clearError = useCallback((field: keyof T) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const resetErrors = useCallback(() => setErrors({}), []);

  return { errors, validate, clearError, resetErrors };
}
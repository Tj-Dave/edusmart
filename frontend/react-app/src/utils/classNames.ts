/**
 * Utility function to conditionally join classNames together
 * @param classes - Variable number of class strings or conditionals
 * @returns Combined class string
 */
export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export default classNames;

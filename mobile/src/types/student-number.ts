export const validStudentNumber = (value: string) => /^[0-9]{5}$/.test(value);
export const studentNumberDigits = (value: string) =>
  value.replace(/[^0-9]/g, "").slice(0, 5);

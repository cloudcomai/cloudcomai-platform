export const isRequired = (value) =>
  value !== null && value !== undefined && String(value).trim().length > 0;

export const isEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());

export const isPhoneNumber = (value) =>
  /^\+?[0-9][0-9\s-]{7,18}$/.test(String(value ?? '').trim());

export const isStrongPassword = (value) => {
  const password = String(value ?? '');
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
};

export const isAdult = (dateOfBirth, referenceDate = new Date()) => {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return false;
  let age = referenceDate.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    referenceDate.getUTCMonth() < dob.getUTCMonth() ||
    (referenceDate.getUTCMonth() === dob.getUTCMonth() &&
      referenceDate.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 18;
};

export const validateRegistration = (input, referenceDate = new Date()) => {
  const errors = {};
  if (!isRequired(input?.name)) errors.name = 'Name is required';
  if (!isRequired(input?.email) && !isRequired(input?.mobile)) {
    errors.contact = 'Email or mobile number is required';
  }
  if (isRequired(input?.email) && !isEmail(input.email)) {
    errors.email = 'Enter a valid email address';
  }
  if (isRequired(input?.mobile) && !isPhoneNumber(input.mobile)) {
    errors.mobile = 'Enter a valid mobile number';
  }
  if (!isStrongPassword(input?.password)) {
    errors.password =
      'Password must have at least 8 characters, including uppercase, lowercase, and a number';
  }
  if (!isAdult(input?.dob, referenceDate)) {
    errors.dob = 'You must be at least 18 years old';
  }
  if (!['Male', 'Female'].includes(input?.gender)) {
    errors.gender = 'Select a valid gender';
  }
  return { valid: Object.keys(errors).length === 0, errors };
};

export const validateMessage = (input) => {
  const valid = isRequired(input?.text) || Boolean(input?.attachment);
  return valid
    ? { valid: true, errors: {} }
    : { valid: false, errors: { message: 'Message or attachment is required' } };
};

export const validatePoll = (input) => {
  const options = Array.isArray(input?.options)
    ? input.options.map((option) => String(option).trim()).filter(Boolean)
    : [];
  const errors = {};
  if (!isRequired(input?.question)) errors.question = 'Poll question is required';
  if (options.length < 2) errors.options = 'Provide at least 2 options';
  return { valid: Object.keys(errors).length === 0, errors };
};

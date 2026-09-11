function pickEmail(contact) { return contact?.emails?.find(item => item?.email)?.email || null; }
function pickPhone(contact) { return contact?.phones?.find(item => item?.number)?.number || null; }

export async function syncPhoneContacts(api, contactsModule = null) {
  try {
    const module = contactsModule || await import('expo-contacts');
    const Contact = module.Contact;
    const ContactField = module.ContactField;
    const permission = await Contact.requestPermissionsAsync();
    if (!permission?.granted) return { granted: false, count: 0 };
    const result = await Contact.getAllDetails([ContactField.FULL_NAME, ContactField.EMAILS, ContactField.PHONES], { limit: 5000, offset: 0 });
    const contacts = (result || []).map(contact => ({
      name: contact.fullName || [contact.givenName, contact.familyName].filter(Boolean).join(' '),
      email: pickEmail(contact),
      phone: pickPhone(contact),
    })).filter(contact => contact.email || contact.phone);
    await api.syncPhoneContacts(contacts);
    return { granted: true, count: contacts.length };
  } catch { return { granted: false, count: 0 }; }
}

export async function loadMobileContacts(api, page = 1, pageSize = 500, { syncDeviceContacts = true } = {}) {
  if (syncDeviceContacts) await syncPhoneContacts(api);
  try { const { data } = await api.getGoogleStatus(); if (data?.connected) await api.syncGoogleContacts(); } catch {}
  const { data } = await api.listContacts(page, pageSize);
  return data?.contacts || [];
}

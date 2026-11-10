import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { platformApi } from '../services/platform';

export default function ContactSelectionModal({ visible, title = 'Select contacts', theme, excludeIds = [], initialSelectedIds = [], onCancel, onSave }) {
  const [contacts, setContacts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setSelectedIds(initialSelectedIds.map(Number));
    setQuery('');
    setError('');
    setLoading(true);
    platformApi.listContacts(1, 500)
      .then(({ data }) => setContacts(Array.isArray(data.contacts) ? data.contacts : []))
      .catch(e => setError(e.message || 'Unable to load contacts.'))
      .finally(() => setLoading(false));
  }, [visible]);

  const excluded = useMemo(() => new Set(excludeIds.map(Number)), [excludeIds]);
  const filtered = useMemo(() => contacts.filter(contact => {
    const id = Number(contact.id || contact.user_id);
    if (!id || excluded.has(id)) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [contact.name, contact.user_id, contact.email, contact.mobile, contact.phone]
      .some(value => String(value || '').toLowerCase().includes(needle));
  }), [contacts, excluded, query]);

  const toggle = id => setSelectedIds(current => current.includes(Number(id))
    ? current.filter(value => value !== Number(id))
    : [...current, Number(id)]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave?.(selectedIds);
      onCancel?.();
    } catch (e) {
      setError(e.message || 'Unable to add the selected contacts.');
    } finally {
      setSaving(false);
    }
  };

  const colors = theme?.colors || {};
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background || '#fff' }}>
        <View style={{ minHeight: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.header || '#2563eb' }}>
          <Pressable onPress={onCancel} disabled={saving}><Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text></Pressable>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>{title}</Text>
          <Pressable onPress={save} disabled={saving}><Text style={{ color: '#fff', fontWeight: '800' }}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
        </View>
        <View style={{ padding: 16, gap: 10 }}>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search name, email or User ID" placeholderTextColor={colors.placeholder || '#8a94a6'} autoCapitalize="none" style={{ minHeight: 48, borderWidth: 1, borderColor: colors.border || '#d8deea', borderRadius: 12, paddingHorizontal: 14, color: colors.text || '#172033' }} />
          <Text style={{ color: colors.secondary || '#64748b', fontSize: 12 }}>{selectedIds.length} selected</Text>
          {error ? <Text accessibilityRole="alert" style={{ color: '#b91c1c' }}>{error}</Text> : null}
        </View>
        {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent || '#3157d5'} /> : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
            {filtered.map(contact => {
              const id = Number(contact.id || contact.user_id);
              const selected = selectedIds.includes(id);
              return (
                <Pressable key={id} onPress={() => toggle(id)} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border || '#e5e7eb', gap: 12 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: selected ? (colors.accent || '#3157d5') : (colors.border || '#cbd5e1'), backgroundColor: selected ? (colors.accent || '#3157d5') : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {selected ? <Text style={{ color: '#fff', fontWeight: '900' }}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text || '#172033', fontWeight: '700' }}>{contact.name || contact.display_name || contact.user_id || 'CloudComAI contact'}</Text>
                    <Text style={{ color: colors.secondary || '#64748b', fontSize: 12 }}>{contact.user_id ? '@' + contact.user_id : (contact.email || contact.mobile || contact.phone || '')}</Text>
                  </View>
                </Pressable>
              );
            })}
            {!filtered.length && !loading ? <Text style={{ paddingVertical: 28, textAlign: 'center', color: colors.secondary || '#64748b' }}>No matching contacts found.</Text> : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

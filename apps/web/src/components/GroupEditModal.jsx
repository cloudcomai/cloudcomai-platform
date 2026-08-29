import React, { useRef, useState } from 'react';
import { ApiRoute } from '@cloudcomai/api-client';
import { Camera, X } from 'lucide-react';

export default function GroupEditModal({ group, groupTypes, apiBridge, close, onGroupUpdated }) {
  const fileRef = useRef(null);
  const [name, setName] = useState(group?.name || '');
  const [category, setCategory] = useState(group?.group_category || groupTypes?.[0] || 'Family Group');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);

  const chooseImage = event => {
    const next = event.target.files?.[0];
    if (!next) return;
    if (!next.type.startsWith('image/')) return alert('Please choose an image file.');
    if (next.size > 2 * 1024 * 1024) return alert('Image must be 2 MB or smaller.');
    setFile(next);
    setPreview(URL.createObjectURL(next));
  };

  const save = async event => {
    event.preventDefault();
    if (!name.trim() || loading || !group?.id) return;
    setLoading(true);
    try {
      const response = await apiBridge(ApiRoute.GROUPS, {
        method: 'PUT',
        query: { id: group.id },
        body: JSON.stringify({ name: name.trim(), group_category: category })
      });
      let nextGroup = { ...group, ...(response.group || {}) };
      if (file) {
        const formData = new FormData();
        formData.append('type', 'group');
        formData.append('id', String(group.id));
        formData.append('image', file);
        const upload = await apiBridge(ApiRoute.MEDIA_UPLOAD, { method: 'POST', body: formData });
        nextGroup = { ...nextGroup, image_url: upload.image_url, image_version: upload.updated_at };
      }
      onGroupUpdated(nextGroup);
      close();
    } catch (err) {
      alert(err.message || 'Unable to update group.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <form onSubmit={save} className="modal-content-card" style={{ width: '440px', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3>Edit Group</h3>
          <button type="button" onClick={close} style={{ background: 'none', border: 0 }} aria-label="Close"><X size={20}/></button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <button type="button" onClick={() => fileRef.current?.click()} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer' }} aria-label="Change group image">
            <div className="avatar-frame" style={{ width: 92, height: 92, position: 'relative' }}>
              {preview ? <img src={preview} alt="Group preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : <div className="avatar-placeholder" style={{ fontSize: 30 }}>{group?.name?.[0] || 'G'}</div>}
              <span style={{ position: 'absolute', right: -3, bottom: -3, background: 'var(--primary-color)', color: '#fff', width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center' }}><Camera size={16}/></span>
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={chooseImage}/>
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-light)', marginTop: -10, marginBottom: 18 }}>Optional group image, max 2 MB</div>

        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Group Name</label>
        <input required value={name} onChange={e => setName(e.target.value)} disabled={loading} style={{ width: '100%', marginTop: 6, marginBottom: 14 }} />

        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Category</label>
        <select value={category} onChange={e => setCategory(e.target.value)} disabled={loading} style={{ width: '100%', marginTop: 6, marginBottom: 20 }}>
          {(groupTypes || []).map(type => <option key={type} value={type}>{type}</option>)}
        </select>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="filter-pill" onClick={close} disabled={loading}>Cancel</button>
          <button type="submit" className="primary" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </div>
  );
}

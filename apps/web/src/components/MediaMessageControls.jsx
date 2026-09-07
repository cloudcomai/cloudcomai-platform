import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Mic, Square, Video } from 'lucide-react';
import { ApiRoute } from '@cloudcomai/api-client';
import { makeVoiceFile } from '../utils/voiceAudio';

export default function MediaMessageControls({ selectedChat, apiBridge, onUploaded }) {
  const [recording, setRecording] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [draft, setDraft] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [busy, setBusy] = useState('');
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const timers = useRef([]);
  const active = useRef(true);
  const disabled = !selectedChat || selectedChat.blocked || Boolean(busy) || Boolean(recording) || Boolean(draft);

  const release = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (recorderRef.current) { recorderRef.current.onstop = null; if (recorderRef.current.state !== 'inactive') recorderRef.current.stop(); }
      release();
    };
  }, []);
  useEffect(() => {
    if (videoRef.current && recording === 'video') videoRef.current.srcObject = streamRef.current;
  }, [recording]);
  useEffect(() => {
    if (!draft) { setPreviewUrl(''); return undefined; }
    const url = URL.createObjectURL(draft.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [draft]);

  const stop = () => { if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); };
  const cancel = () => {
    if (recorderRef.current) { recorderRef.current.onstop = null; stop(); }
    release(); setRecording(''); setDraft(null); setSeconds(0);
  };
  const record = async type => {
    if (disabled) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { alert('Recording requires a supported browser and HTTPS. You can also choose a video file.'); return; }
    setBusy('permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 } } : false });
      if (!active.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const candidates = type === 'voice' ? ['audio/webm;codecs=opus', 'audio/mp4'] : ['video/webm;codecs=vp8,opus', 'video/mp4', 'video/webm'];
      const mimeType = candidates.find(value => MediaRecorder.isTypeSupported(value));
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), ...(type === 'video' ? { videoBitsPerSecond: 1500000 } : {}) });
      recorderRef.current = recorder;
      const chunks = [];
      let total = 0;
      recorder.ondataavailable = event => {
        if (event.data?.size) { chunks.push(event.data); total += event.data.size; }
        if (total > 24 * 1024 * 1024) stop();
      };
      recorder.onerror = () => { cancel(); alert('Recording failed. Please try again.'); };
      recorder.onstop = async () => {
        release();
        if (!active.current) return;
        setRecording('');
        const actualMime = recorder.mimeType || mimeType || (type === 'voice' ? 'audio/webm' : 'video/webm');
        const extension = actualMime.includes('mp4') ? (type === 'voice' ? 'm4a' : 'mp4') : 'webm';
        setBusy('processing');
        try {
          const blob = new Blob(chunks, { type: actualMime });
          const file = type === 'voice' ? await makeVoiceFile(blob) : new File([blob], `${type}-${Date.now()}.${extension}`, { type: actualMime });
          if (active.current) setDraft({ type, file });
        } catch (error) { if (active.current) alert(error.message || 'Unable to prepare the recording.'); }
        finally { if (active.current) setBusy(''); }
      };
      recorder.start(250);
      setRecording(type); setSeconds(0);
      const start = Date.now();
      timers.current = [setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 250), setTimeout(stop, (type === 'voice' ? 30 : 60) * 1000)];
    } catch (error) {
      release();
      alert(error.name === 'NotAllowedError' ? 'Allow microphone/camera access to record a message.' : 'Unable to start recording on this device.');
    } finally { if (active.current) setBusy(''); }
  };
  const send = async () => {
    if (!draft || busy) return;
    if (!draft.file.size || draft.file.size > 25 * 1024 * 1024) { alert('Media must be between 1 byte and 25 MB.'); return; }
    setBusy('upload');
    try {
      const form = new FormData();
      form.append('chat_id', String(selectedChat.id)); form.append('file', draft.file);
      form.append('message_type', draft.type); form.append('download_policy', 'APPROVAL_REQUIRED');
      const result = await apiBridge(ApiRoute.UPLOAD_ATTACHMENT, { method: 'POST', body: form });
      if (active.current) { onUploaded?.(result.message); setDraft(null); }
    } catch (error) { if (active.current) alert(error.message || 'Unable to send media.'); }
    finally { if (active.current) setBusy(''); }
  };
  const shareLocation = () => {
    if (disabled) return;
    if (!navigator.geolocation) { alert('Location is unavailable in this browser.'); return; }
    setBusy('location');
    navigator.geolocation.getCurrentPosition(async position => {
      if (!active.current) return;
      try {
        const result = await apiBridge(ApiRoute.MESSAGES, { method: 'POST', body: { chat_id: Number(selectedChat.id), type: 'location', latitude: position.coords.latitude, longitude: position.coords.longitude, label: 'Current location' } });
        if (active.current) onUploaded?.(result.message);
      } catch (error) { if (active.current) alert(error.message || 'Unable to share location.'); }
      finally { if (active.current) setBusy(''); }
    }, error => { if (active.current) { setBusy(''); alert(error.code === 1 ? 'Allow location access to share your location.' : 'Unable to find your location.'); } }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  };

  return <div className="media-message-controls">
    <button className="composer-addon-btn" disabled={disabled} onClick={() => record('voice')} title="Record voice message (up to 30 seconds)" aria-label="Record voice message"><Mic size={18} /></button>
    <button className="composer-addon-btn" disabled={disabled} onClick={() => record('video')} title="Record video message (up to 60 seconds)" aria-label="Record video message"><Video size={18} /></button>
    <button className="composer-addon-btn media-file-button" disabled={disabled} onClick={() => inputRef.current?.click()} title="Choose video file" aria-label="Choose video file">＋</button>
    <button className="composer-addon-btn" disabled={disabled} onClick={shareLocation} title="Share current location" aria-label="Share current location">{busy === 'location' ? '…' : <MapPin size={18} />}</button>
    <input ref={inputRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/3gpp" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) setDraft({ type: 'video', file }); }} />
    {(recording || draft) && <div className="modal-overlay"><div className="modal-content-card media-recording-dialog" role="dialog" aria-modal="true" aria-label="Media message">
      <h3>{recording ? `Recording ${recording === 'voice' ? 'voice' : 'video'} · ${seconds}s` : 'Preview your message'}</h3>
      {recording === 'video' && <video ref={videoRef} autoPlay muted playsInline />}
      {draft && previewUrl && (draft.type === 'voice' ? <audio src={previewUrl} controls /> : <video src={previewUrl} controls playsInline />)}
      {recording ? <button onClick={stop}><Square size={16} /> Stop recording</button> : <button onClick={send} disabled={Boolean(busy)}>{busy ? 'Sending…' : 'Send message'}</button>}
      <button onClick={cancel} disabled={Boolean(busy)}>Cancel</button>
    </div></div>}
  </div>;
}

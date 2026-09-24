import React from 'react';
import { APP_THEMES } from '../services/appTheme';

const previewOrder = ['primary', 'background', 'surface', 'textPrimary', 'outgoingBubble'];

export default function ThemePicker({value,onChange,required=false}) {
  return <div className={required?'theme-picker theme-picker-required':'theme-picker'}>
    <h3>{required?'Choose your CloudComAI theme':'Appearance → Theme'}</h3>
    <p>{required?'Select a theme to continue. CloudCom Blue is the default theme.':'Choose a complete app-wide theme. Your selection is saved and follows you across chats, profiles, settings and dialogs.'}</p>
    <div className="theme-options" role="radiogroup" aria-label="CloudComAI themes">
      {Object.values(APP_THEMES).map(theme => <button type="button" key={theme.id} className={value===theme.id?'theme-option selected':'theme-option'} onClick={()=>onChange(theme.id)} role="radio" aria-checked={value===theme.id}>
        <span className="theme-preview" aria-hidden="true">
          <span className="theme-preview-header" style={{backgroundColor:theme.colors.headerBackground}} />
          <span className="theme-preview-body" style={{backgroundColor:theme.colors.background}}>
            <i style={{backgroundColor:theme.colors.incomingBubble,borderColor:theme.colors.border}} />
            <i style={{backgroundColor:theme.colors.outgoingBubble}} />
            <b style={{backgroundColor:theme.colors.primary}} />
          </span>
        </span>
        <span className="theme-swatches">{previewOrder.map(key=><i key={key} style={{backgroundColor:theme.colors[key]}} />)}</span>
        <strong>{theme.label}{theme.id==='modern-blue'?' (Default)':''}</strong>
      </button>)}
    </div>
  </div>;
}

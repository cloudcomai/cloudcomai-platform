import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export default function CallMenu({ visible, isGroup = false, onClose, onAudioCall, onVideoCall, onSelectParticipants }) {
  const [participantMode, setParticipantMode] = useState(false);
  const close = () => { setParticipantMode(false); onClose?.(); };
  const choose = type => {
    if (isGroup) { setParticipantMode(true); onSelectParticipants?.(type); return; }
    type === 'audio' ? onAudioCall?.() : onVideoCall?.();
    close();
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
    <Pressable style={styles.backdrop} onPress={close}>
      <Pressable style={styles.menu} onPress={event => event.stopPropagation()}>
        <Text style={styles.title}>{participantMode ? 'Choose people for the call' : 'Call'}</Text>
        {!participantMode ? <>
          <Pressable accessibilityRole="button" accessibilityLabel="Audio call" style={styles.item} onPress={() => choose('audio')}><Text style={styles.icon}>☎</Text><Text style={styles.label}>Audio call</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Video call" style={styles.item} onPress={() => choose('video')}><Text style={styles.icon}>▣</Text><Text style={styles.label}>Video call</Text></Pressable>
        </> : <>
          <Text style={styles.hint}>Select participants in the existing group member picker, then start the call.</Text>
          <Pressable style={styles.item} onPress={() => { onSelectParticipants?.('audio'); close(); }}><Text style={styles.icon}>☎</Text><Text style={styles.label}>Audio conference</Text></Pressable>
          <Pressable style={styles.item} onPress={() => { onSelectParticipants?.('video'); close(); }}><Text style={styles.icon}>▣</Text><Text style={styles.label}>Video conference</Text></Pressable>
        </>}
        <Pressable style={styles.cancel} onPress={close}><Text style={styles.cancelText}>Cancel</Text></Pressable>
      </Pressable>
    </Pressable>
  </Modal>;
}
const styles = StyleSheet.create({ backdrop:{flex:1,backgroundColor:'#0008',justifyContent:'flex-start',alignItems:'flex-end',paddingTop:72,paddingRight:12},menu:{width:250,backgroundColor:'#fff',borderRadius:16,padding:10,elevation:8,shadowOpacity:.2,shadowRadius:12},title:{fontSize:17,fontWeight:'800',padding:10,color:'#172033'},item:{flexDirection:'row',alignItems:'center',padding:13,borderRadius:10},icon:{width:30,fontSize:20},label:{fontSize:16,fontWeight:'600',color:'#172033'},hint:{paddingHorizontal:10,paddingBottom:8,color:'#596579',lineHeight:20},cancel:{padding:12,alignItems:'center'},cancelText:{color:'#3157d5',fontWeight:'700'}});

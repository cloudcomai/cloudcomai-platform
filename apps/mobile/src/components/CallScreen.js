import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function CallScreen({ call, incoming = false, connecting = false, onAccept, onDecline, onEnd, onToggleMute, onToggleCamera, onToggleSpeaker, onSwitchCamera }) {
  if (incoming) return <View style={styles.root}><Text style={styles.type}>{call.type === 'video' ? 'Video call' : 'Audio call'}</Text><Text style={styles.name}>{call.callerName || 'Incoming call'}</Text><View style={styles.actions}><Pressable accessibilityRole="button" accessibilityLabel="Decline call" onPress={onDecline} style={styles.danger}><Text style={styles.actionText}>Decline</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Accept call" onPress={onAccept} style={styles.accept}><Text style={styles.actionText}>Accept</Text></Pressable></View></View>;
  return <View style={styles.root}>
    {call.type === 'video' && <View style={styles.videoPlaceholder}><Text style={styles.videoText}>{connecting ? 'Connecting video…' : 'Video'}</Text></View>}
    <Text style={styles.type}>{connecting ? 'Connecting…' : call.type === 'video' ? 'Video call' : 'Audio call'}</Text>
    <Text style={styles.name}>{call.peerName || 'CloudComAI call'}</Text>
    <View style={styles.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel={call.muted ? 'Unmute microphone' : 'Mute microphone'} onPress={onToggleMute} style={styles.control}><Text style={styles.controlText}>{call.muted ? 'Unmute' : 'Mute'}</Text></Pressable>
      {call.type === 'video' && <Pressable accessibilityRole="button" accessibilityLabel={call.cameraEnabled ? 'Turn camera off' : 'Turn camera on'} onPress={onToggleCamera} style={styles.control}><Text style={styles.controlText}>{call.cameraEnabled ? 'Camera off' : 'Camera on'}</Text></Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel={call.speakerEnabled ? 'Turn speaker off' : 'Turn speaker on'} onPress={onToggleSpeaker} style={styles.control}><Text style={styles.controlText}>{call.speakerEnabled ? 'Speaker' : 'Earpiece'}</Text></Pressable>
      {call.type === 'video' && <Pressable accessibilityRole="button" accessibilityLabel="Switch camera" onPress={onSwitchCamera} style={styles.control}><Text style={styles.controlText}>Switch</Text></Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel="End call" onPress={onEnd} style={styles.end}><Text style={styles.actionText}>End</Text></Pressable>
    </View>
  </View>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#101522',alignItems:'center',justifyContent:'center',padding:24},type:{color:'#aeb8cb',fontSize:16},name:{color:'#fff',fontSize:25,fontWeight:'800',marginTop:8},actions:{flexDirection:'row',gap:18,marginTop:48},accept:{backgroundColor:'#248a52',paddingHorizontal:26,paddingVertical:14,borderRadius:30},danger:{backgroundColor:'#c93b4a',paddingHorizontal:26,paddingVertical:14,borderRadius:30},actionText:{color:'#fff',fontWeight:'800'},videoPlaceholder:{width:'100%',height:300,backgroundColor:'#202a3c',alignItems:'center',justifyContent:'center',borderRadius:18,marginBottom:30},videoText:{color:'#aeb8cb',fontSize:18},controls:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:10,marginTop:36},control:{paddingHorizontal:14,paddingVertical:11,borderRadius:22,backgroundColor:'#293449'},controlText:{color:'#fff',fontWeight:'700'},end:{paddingHorizontal:20,paddingVertical:11,borderRadius:22,backgroundColor:'#c93b4a'}});

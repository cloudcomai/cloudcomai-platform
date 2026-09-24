import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CHAT_THEMES, setChatThemeSettings } from '../services/chatTheme';

export default function ChatThemeSettings({value,onChange,onBack,required=false}){
 const select=async id=>onChange?.(await setChatThemeSettings({id}));
 return <SafeAreaView style={styles.page}>
   <View style={styles.header}>{!required?<Pressable onPress={onBack}><Text style={styles.back}>‹ Back</Text></Pressable>:<View style={styles.spacer}/>}<Text style={styles.title}>{required?'Choose Theme':'Appearance → Theme'}</Text><View style={styles.spacer}/></View>
   <ScrollView contentContainerStyle={styles.content}>
     <Text style={styles.help}>{required?'Choose a theme to continue. CloudCom Blue is the default.':'Choose a complete app-wide theme. The selection is saved and follows you through chats, profiles, settings, menus and dialogs.'}</Text>
     {Object.values(CHAT_THEMES).map(theme=><Pressable key={theme.id} accessibilityRole="radio" accessibilityState={{selected:value?.id===theme.id}} style={[styles.card,value?.id===theme.id&&styles.selected]} onPress={()=>select(theme.id)}>
       <View style={styles.preview}><View style={[styles.previewHeader,{backgroundColor:theme.colors.header}]} /><View style={[styles.previewBody,{backgroundColor:theme.colors.background}]}><View style={[styles.previewBubble,{backgroundColor:theme.colors.incoming,borderColor:theme.colors.border}]} /><View style={[styles.previewBubble,{backgroundColor:theme.colors.outgoing}]} /><View style={[styles.previewDot,{backgroundColor:theme.colors.primary}]} /></View></View>
       <View style={styles.swatches}>{[theme.colors.primary,theme.colors.background,theme.colors.surface,theme.colors.textPrimary,theme.colors.outgoing].map(color=><View key={color} style={[styles.dot,{backgroundColor:color,borderColor:theme.colors.border}]}/>)}</View>
       <Text style={styles.label}>{theme.label}{theme.id==='modern-blue'?' (Default)':''}</Text>
       {value?.id===theme.id ? <Text style={styles.selectedText}>✓ Selected</Text> : null}
     </Pressable>)}
   </ScrollView>
 </SafeAreaView>;
}

const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:'#F7FAFC'},
 header:{minHeight:62,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#0877D1'},
 back:{color:'#FFFFFF',fontWeight:'800',width:64},
 spacer:{width:64},
 title:{color:'#FFFFFF',fontSize:18,fontWeight:'800'},
 content:{padding:18,gap:12},
 help:{color:'#52667A',lineHeight:20,marginBottom:4},
 card:{padding:16,borderRadius:16,borderWidth:1,borderColor:'#D7E3EF',backgroundColor:'#FFFFFF'},
 selected:{borderWidth:2,borderColor:'#0877D1'},
 preview:{overflow:'hidden',borderRadius:12,borderWidth:1,borderColor:'#D7E3EF'},
 previewHeader:{height:20},
 previewBody:{minHeight:58,padding:9,flexDirection:'row',alignItems:'center',gap:8},
 previewBubble:{width:52,height:20,borderRadius:10,borderWidth:1},
 previewDot:{width:20,height:20,borderRadius:10},
 swatches:{flexDirection:'row',gap:8,marginTop:12},
 dot:{width:24,height:24,borderRadius:12,borderWidth:1},
 label:{marginTop:10,color:'#102A43',fontSize:15,fontWeight:'800'},
 selectedText:{marginTop:5,color:'#138A5B',fontSize:12,fontWeight:'800'},
});

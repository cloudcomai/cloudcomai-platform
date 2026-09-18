import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Appearance,
  Alert,
  AppState,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { createPollingMessageTransport, createReadTracker, formatMessageTimestamp, mergeMessageBatch } from '@cloudcomai/chat-core';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as ScreenCapture from 'expo-screen-capture';
import MediaMessage from './src/components/MediaMessage';
import MediaComposer from './src/components/MediaComposer';
import PrivacySettings from './src/components/PrivacySettings';
import AccountTools from './src/components/AccountTools';
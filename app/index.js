import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { deleteKit, deleteKitImage, driveImageUrl, searchKits, updateKit, uploadKit } from '../services/drive';
import ImageViewing from "react-native-image-viewing";
const initialKits = [];

const emptyForm = { client: '', images: [] };


export default function HomeScreen() {
  const [kits, setKits] = useState(initialKits);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedKit, setSelectedKit] = useState(null);
  const [editingKit, setEditingKit] = useState(null);
  const [previewUri, setPreviewUri] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
const [editingClient, setEditingClient] = useState(false);
const [editedClient, setEditedClient] = useState("");
const [highlightImageId, setHighlightImageId] = useState(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  const loadDriveKits = async () => {
    setRefreshing(true);
    setRefreshing(true);
    try {
      setKits(await searchKits(''));
    } catch (error) {
      Alert.alert('Could not load Drive records', 'Check that the Cretile server is running and your phone can reach it.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadDriveKits(); }, []);

  const filteredKits = useMemo(() => {
  const term = query.trim().toLowerCase();

  if (!term) return kits;

  return kits.filter((kit) => {
    const clientMatch = kit.client.toLowerCase().includes(term);

    const imageMatch = kit.images.some((image) => {
      const name =
        typeof image === "string"
          ? ""
          : (image.name || "").toLowerCase();

      return name.includes(term);
    });

    return clientMatch || imageMatch;
  });
}, [kits, query]);

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const addPhoto = async (useCamera) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', `Please allow access to your ${useCamera ? 'camera' : 'photos'} to add an image.`);
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.75 });

    if (!result.canceled) {
      setForm((current) => ({ ...current, images: [...current.images, ...result.assets.map((asset) => asset.uri)] }));
    }
  };

  const choosePhotoSource = () => {
    Alert.alert('Add photos', 'Choose how to add the next photo.', [
      { text: 'Take photo', onPress: () => addPhoto(true) },
      { text: 'Choose from library', onPress: () => addPhoto(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const saveKit = async () => {
    if (!form.client.trim()) {
  Alert.alert("Missing information", "Enter Client or Company Name");
  return;
}
    setSaving(true);
    try {
      // With EXPO_PUBLIC_API_URL set, this calls the backend and uploads to Drive.
      // Without it, the local record makes the UI easy to demo in Expo Go.
     console.log("Save button pressed");
console.log(form);
      const remoteKit = editingKit
  ? await updateKit(editingKit.id, form)
  : await uploadKit(form);
      const localKit = editingKit
        ? { ...editingKit, ...form, images: [...editingKit.images, ...form.images], updatedAt: new Date().toISOString() }
        : { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() };
      const savedKit = remoteKit || localKit;
      setKits((current) => editingKit
        ? current.map((kit) => kit.id === editingKit.id ? savedKit : kit)
        : [savedKit, ...current]);
    } catch (error) {
      Alert.alert('Upload failed', error.message || 'Please try again.');
      setSaving(false);
      return;
    }
    setSaving(false);
    setModalVisible(false);
    setForm(emptyForm);
    setEditingKit(null);
  };

  const openDriveLink = async (url) => {
    if (!url) {
      Alert.alert('Not in Drive yet', 'This demo record was saved only on this device. Connect Google Drive to open its folder.');
      return;
    }
    await Linking.openURL(url);
  };

  const confirmDelete = () => {
    if (!selectedKit) return;
    Alert.alert('Delete this kit?', 'Its record and uploaded Drive folder will be deleted. This cannot be undone from the app.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: deleteSelectedKit },
    ]);
  };


  const confirmDeleteImage = (image) => {
    if (!selectedKit) return;
    Alert.alert('Delete this photo?', 'It will be removed from this kit and Google Drive.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteImage(image) },
    ]);
  };

  const deleteImage = async (image) => {
    if (!selectedKit) return;
    try {
      const isRemoteImage = typeof image !== 'string' && process.env.EXPO_PUBLIC_API_URL;
      const updated = isRemoteImage
        ? await deleteKitImage(selectedKit.id, image.id)
        : { ...selectedKit, images: selectedKit.images.filter((item) => item !== image) };
      setSelectedKit(updated);
      setKits((current) => current.map((kit) => kit.id === updated.id ? updated : kit));
    } catch (error) {
      Alert.alert('Delete failed', error.message || 'Please try again.');
    }
  };

  const deleteSelectedKit = async () => {
    if (!selectedKit) return;
    setDeleting(true);
    try {
      if (process.env.EXPO_PUBLIC_API_URL && selectedKit.driveFolderId) await deleteKit(selectedKit.driveFolderId);
      setKits((current) => current.filter((kit) => kit.id !== selectedKit.id));
      setSelectedKit(null);
    } catch (error) {
      Alert.alert('Delete failed', error.message || 'Please try again.');
    } finally {
      setDeleting(false);
    }
  };
const searchSerial = () => {
  const term = query.trim().toLowerCase();

  if (!term) return;

  const client = kits.find((kit) =>
    kit.client.toLowerCase().includes(term)
  );

  if (client) {
    setSelectedKit(client);
    return;
  }

  for (const kit of kits) {
    const match = kit.images.find(
      (img) =>
        typeof img !== "string" &&
        img.name &&
        img.name.replace(".jpg", "").toLowerCase() === term
    );

    if (match) {
      setSelectedKit(kit);
      setHighlightImageId(match.id);
      return;
    }
  }

  Alert.alert("Not Found", "No matching serial found.");
};
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>File Record</Text>
            <Text style={styles.title}>Cretile</Text>
          </View>
          <Pressable style={styles.addButton} onPress={() => { setEditingKit(null); setForm(emptyForm); setModalVisible(true); }} accessibilityLabel="Add a kit">
            <Ionicons name="add" size={27} color="#FFFFFF" />
          </Pressable>
        </View>

        <Text style={styles.subtitle}>Upload Document.</Text>
        <View style={styles.searchBox}>
  <Ionicons name="search-outline" size={20} color="#6D7280" />

  <TextInput
    value={query}
    onChangeText={setQuery}
    onSubmitEditing={searchSerial}
    returnKeyType="search"
    placeholder="Search client or serial number"
    placeholderTextColor="#8B90A0"
    style={styles.searchInput}
  />
</View>

<Text style={styles.sectionTitle}>
  {query ? `${filteredKits.length} results` : "Clients"}
</Text>
        <FlatList
          data={filteredKits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <KitCard kit={item} now={now} onPress={() => setSelectedKit(item)} />}
          refreshing={refreshing}
          onRefresh={loadDriveKits}
          ListEmptyComponent={<Text style={styles.emptyText}>No matching kits found.</Text>}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <Modal visible={modalVisible} animationType="slide"  onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => { setModalVisible(false); setForm(emptyForm); setEditingKit(null); }} hitSlop={12}><Text style={styles.cancel}>Cancel</Text></Pressable>
            <Text style={styles.modalTitle}>{editingKit ? 'Edit ' : 'New '}</Text>
            <Pressable onPress={saveKit} disabled={saving}><Text style={[styles.save, saving && styles.disabled]}>{saving ? 'Saving…' : editingKit ? 'Update' : 'Save'}</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.formIntro}>Add details.</Text>
            {editingKit && <Text style={styles.editHint}>Any photos added here will be added to the existing Drive folder.</Text>}
            
            <Field label="Client" value={form.client} onChangeText={(v) => updateForm('client', v)} placeholder="Client or company name" />
           
            <View style={styles.photoHeader}><Text style={styles.fieldLabel}>Photos</Text><Text style={styles.photoCount}>{form.images.length} attached</Text></View>
            <Pressable style={styles.uploadButton} onPress={choosePhotoSource}>
              <Ionicons name="camera-outline" size={24} color="#155EEF" />
              <Text style={styles.uploadText}>Take or upload photos</Text>
            </Pressable>
            {form.images.length > 0 && <View style={styles.photoGrid}>{form.images.map((uri, index) => <View key={uri} style={styles.imageWrap}><Image source={{ uri }} style={styles.thumbnail} /><Pressable onPress={() => setForm((current) => ({ ...current, images: current.images.filter((_, i) => i !== index) }))} style={styles.removeImage}><Ionicons name="close" color="#fff" size={14} /></Pressable></View>)}</View>}
            <View style={styles.driveNote}><Ionicons name="cloud-upload-outline" size={20} color="#155EEF" /><Text style={styles.driveNoteText}>When Google Drive is connected, each kit gets its own folder and photos upload automatically.</Text></View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={Boolean(selectedKit)} animationType="slide" onRequestClose={() => setSelectedKit(null)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>

  <Pressable
    onPress={() => setSelectedKit(null)}
    hitSlop={12}
  >
    <Text style={styles.cancel}>Back</Text>
  </Pressable>

  <Text style={styles.modalTitle}>Details</Text>

  <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>

    <Pressable
      onPress={() => openDriveLink(selectedKit?.driveFolderUrl)}
      hitSlop={12}
    >
      <Ionicons
        name="folder-open-outline"
        size={24}
        color="#155EEF"
      />
    </Pressable>

    <Pressable
      onPress={confirmDelete}
      disabled={deleting}
      hitSlop={12}
    >
      <Ionicons
        name="trash-outline"
        size={24}
        color="#D92D20"
      />
    </Pressable>

  </View>

</View>
          {selectedKit && <ScrollView contentContainerStyle={styles.form}>
      
            <View style={styles.clientCard}>
  {editingClient ? (
    <TextInput
      style={styles.clientInput}
      value={editedClient}
      onChangeText={setEditedClient}
      autoFocus
    />
  ) : (
    <Text style={styles.clientName}>
      {selectedKit.client}
    </Text>
  )}

  <Pressable
    onPress={async () => {
      if (!editingClient) {
        setEditedClient(selectedKit.client);
        setEditingClient(true);
        return;
      }

      // Save
      const updated = {
        ...selectedKit,
        client: editedClient,
      };

      setKits((current) =>
        current.map((k) =>
          k.id === selectedKit.id ? updated : k
        )
      );

      setSelectedKit(updated);

      // If you already have updateKit(), call it here
      // await updateKit(selectedKit.id, { client: editedClient });

      setEditingClient(false);
    }}
  >
    <Ionicons
      name={editingClient ? "checkmark" : "create-outline"}
      size={24}
      color="#155EEF"
    />
  </Pressable>
</View>



<View style={styles.photoHeader}>

  <Text style={styles.fieldLabel}>
    Photos ({selectedKit.images.length})
  </Text>

  <Pressable onPress={choosePhotoSource}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons
        name="add-circle-outline"
        size={20}
        color="#155EEF"
      />
      <Text
        style={{
          color: "#155EEF",
          fontWeight: "700",
          fontSize: 15,
        }}
      >
        Add
      </Text>
    </View>
  </Pressable>

</View>

{selectedKit.images.length === 0 ? (
  <Text style={styles.noPhotos}>
    No photos were added to this kit.
  </Text>
) : (
  <View style={styles.detailPhotos}>
    {selectedKit.images.map((image) => {
      const imageUri =
        typeof image === "string"
          ? image
          : driveImageUrl(image.id);

      const imageName =
        typeof image === "string"
          ? selectedKit.serialNumber
          : (image.name || selectedKit.serialNumber).replace(".jpg", "");

      return (
        <View
          key={typeof image === "string" ? image : image.id}
          style={styles.detailPhotoWrap}
        >
          <Pressable
  style={[
    styles.detailPhoto,
    highlightImageId === (typeof image === "string" ? image : image.id) &&
      styles.highlightPhoto,
  ]}
  onPress={() => {
  setPreviewUri(imageUri);
}}
>
            <Image
              source={{ uri: imageUri }}
              style={styles.detailImage}
            />

            <Text style={styles.openPhotoText}>
              {imageName}
            </Text>
          </Pressable>

          <Pressable
            style={styles.deleteImageButton}
            onPress={() => confirmDeleteImage(image)}
          >
            <Ionicons
              name="trash-outline"
              size={14}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      );
    })}
  </View>
)}



          </ScrollView>}
        </SafeAreaView>
      </Modal>
<Modal
  visible={Boolean(previewUri)}
  transparent
  animationType="fade"
  onRequestClose={() => setPreviewUri(null)}
>
  <View style={styles.previewBackdrop}>
    <Pressable
      style={styles.previewClose}
      onPress={() => setPreviewUri(null)}
    >
      <Ionicons
        name="close"
        size={28}
        color="#FFFFFF"
      />
    </Pressable>

    {previewUri && (
      <Image
        source={{ uri: previewUri }}
        style={styles.previewImage}
        resizeMode="contain"
      />
    )}
  </View>
</Modal>
      
    </SafeAreaView>
  );
}

function KitCard({ kit, now, onPress }) {
  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityHint="Opens kit details"
    >
      <View style={styles.cardIcon}>
        <Ionicons
          name="briefcase-outline"
          size={22}
          color="#155EEF"
        />
      </View>

      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>
          {kit.client}
        </Text>
      </View>

      <View style={styles.cardRight}>
        <Text style={styles.date}>
          {formatTimestamp(kit.createdAt, now)}
        </Text>

        <View style={styles.photoPill}>
          <Ionicons
            name="images-outline"
            size={14}
            color="#475467"
          />
          <Text style={styles.photoPillText}>
            {kit.images.length}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function formatTimestamp(value, now) {
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return value || '';
  const seconds = Math.max(0, Math.floor((now - createdAt) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 60 * 60) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 24 * 60 * 60) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 48 * 60 * 60) return 'Yesterday';
  return new Date(createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function Field({ label, ...props }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={styles.input} placeholderTextColor="#98A2B3" {...props} /></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' }, container: { flex: 1, paddingHorizontal: 20 }, header: { paddingTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { color: '#155EEF', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, title: { fontSize: 31, fontWeight: '800', color: '#101828', marginTop: 2 }, subtitle: { color: '#667085', fontSize: 15, marginTop: 5, marginBottom: 24 }, addButton: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#155EEF', alignItems: 'center', justifyContent: 'center', shadowColor: '#155EEF', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } }, searchBox: { height: 52, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC', borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 10 }, searchInput: { flex: 1, fontSize: 15, color: '#101828' }, sectionTitle: { color: '#344054', fontSize: 17, fontWeight: '700', marginTop: 27, marginBottom: 12 }, list: { paddingBottom: 28, gap: 11 }, card: { minHeight: 101, borderRadius: 17, backgroundColor: '#FFFFFF', padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#101828', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, cardIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#EFF4FF', justifyContent: 'center', alignItems: 'center', marginRight: 13 }, cardText: { flex: 1 }, cardTitle: { color: '#101828', fontSize: 16, fontWeight: '700' }, cardClient: { color: '#667085', fontSize: 13, marginTop: 3 }, serial: { color: '#98A2B3', fontSize: 12, marginTop: 5, fontWeight: '600' }, cardRight: { alignItems: 'flex-end', alignSelf: 'stretch', justifyContent: 'space-between' }, date: { color: '#98A2B3', fontSize: 11 }, photoPill: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: '#F2F4F7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }, photoPillText: { color: '#475467', fontSize: 12, fontWeight: '700' }, emptyText: { color: '#667085', textAlign: 'center', paddingTop: 40 }, modalSafeArea: { flex: 1, backgroundColor: '#F8FAFC' }, modalHeader: { height: 60, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#EAECF0' }, modalTitle: { color: '#101828', fontWeight: '800', fontSize: 17 }, cancel: { color: '#667085', fontSize: 16 }, save: { color: '#155EEF', fontWeight: '800', fontSize: 16 }, delete: { color: '#D92D20', fontWeight: '800', fontSize: 16 }, disabled: { opacity: 0.5 }, form: { padding: 20, paddingBottom: 42 }, formIntro: { color: '#667085', fontSize: 15, lineHeight: 21, marginBottom: 25 }, editHint: { color: '#155EEF', backgroundColor: '#EFF4FF', padding: 12, borderRadius: 10, marginBottom: 18, lineHeight: 19 }, field: { marginBottom: 18 }, fieldLabel: { color: '#344054', fontSize: 14, fontWeight: '700', marginBottom: 8 }, input: { height: 52, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D0D5DD', paddingHorizontal: 14, color: '#101828', fontSize: 16 }, 
 photoHeader: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
},
highlightPhoto: {
  borderWidth: 4,
  borderColor: "#155EEF",
},
  photoCount: { color: '#667085', fontSize: 13 }, uploadButton: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#84ADFF', borderRadius: 14, minHeight: 105, backgroundColor: '#F5F8FF', alignItems: 'center', justifyContent: 'center', gap: 7 }, uploadText: { color: '#155EEF', fontSize: 15, fontWeight: '700' }, photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 13 }, imageWrap: { width: 88, height: 88 }, thumbnail: { height: '100%', width: '100%', borderRadius: 11 }, removeImage: { position: 'absolute', top: -5, right: -5, width: 21, height: 21, borderRadius: 11, backgroundColor: '#344054', alignItems: 'center', justifyContent: 'center' }, driveNote: { marginTop: 23, borderRadius: 12, backgroundColor: '#EFF4FF', padding: 14, flexDirection: 'row', gap: 10 }, driveNoteText: { color: '#475467', flex: 1, fontSize: 13, lineHeight: 18 }, detailTitle: { color: '#101828', fontSize: 27, fontWeight: '800' }, 
  detailClient: { color: '#0e0e0e', fontSize: 18, marginTop: 5, marginBottom: 18 }, 
  clientCard: {
  backgroundColor: "#FFFFFF",
  borderRadius: 16,
  padding: 18,
  marginBottom: 22,
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  borderWidth: 1,
  borderColor: "#EAECF0",
},

clientName: {
  fontSize: 22,
  fontWeight: "700",
  color: "#101828",
},
  detailSerial: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginTop: 22, marginBottom: 18 }, detailSerialLabel: { color: '#98A2B3', fontSize: 11, fontWeight: '800', letterSpacing: 1 }, detailSerialValue: { color: '#344054', fontSize: 16, fontWeight: '700', marginTop: 5 }, 
  openDriveButton: {
  backgroundColor: '#155EEF',
  borderRadius: 13,
  height: 52,
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
  gap: 9,
  marginTop: 24,
  marginBottom: 12,
},
  openDriveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' }, editButton: { height: 50, borderRadius: 13, borderWidth: 1, borderColor: '#84ADFF', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginBottom: 27 }, editButtonText: { color: '#155EEF', fontSize: 15, fontWeight: '800' }, noPhotos: { color: '#667085', marginTop: -2 }, detailPhotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 }, detailPhotoWrap: { width: 105, height: 125 }, detailPhoto: { width: 105, height: 125, borderRadius: 12, overflow: 'hidden', backgroundColor: '#EFF4FF', alignItems: 'center', justifyContent: 'center' }, detailImage: { width: '100%', height: '100%' }, openPhotoText: { position: 'absolute', bottom: 0, width: '100%', color: '#FFFFFF', backgroundColor: 'rgba(16,24,40,0.58)', textAlign: 'center', fontWeight: '700', fontSize: 12, paddingVertical: 5 }, deleteImageButton: { position: 'absolute', right: -6, top: -6, width: 25, height: 25, borderRadius: 13, backgroundColor: '#D92D20', alignItems: 'center', justifyContent: 'center' }, 
  previewBackdrop: {
  flex: 1,
  backgroundColor: "#000",
  justifyContent: "center",
  alignItems: "center",
},

previewImage: {
  width: "100%",
  height: "100%",
},

previewClose: {
  position: "absolute",
  top: 50,
  right: 20,
  width: 42,
  height: 42,
  borderRadius: 21,
  backgroundColor: "rgba(0,0,0,0.6)",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999,
},
});

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLayout } from '../../layouts/LayoutContext';
import { Button, Input, Card } from '@docstruc/ui';
import { ModernModal } from '../../components/ModernModal';
import { ImageUploader } from '../../components/ImageUploader';
import { useToast } from '../../components/ToastProvider';
import { supabase } from '../../lib/supabase';
import { colors, spacing } from '@docstruc/theme';
import { Plus, Trash2, Edit2, User, Building, Hammer } from 'lucide-react';

export function Accessors() {
  const { setTitle, setSubtitle } = useLayout();
  useEffect(() => {
    setTitle('Zugreifer');
    setSubtitle('Mitarbeiter, Bauherren und Gewerke verwalten.');
    return () => setSubtitle('');
  }, [setTitle, setSubtitle]);
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'employees' | 'owners' | 'subcontractors'>('employees');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Cache to make switching tabs instant
  const cache = useRef<Record<string, any[]>>({});

  // Selected Item for Detail View / Editing
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Generic Item State (for Create/Edit)
  const [personForm, setPersonForm] = useState({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      // Employee
      personal_number: '',
      department: '',
      // Owner
      company_name: '',
      address: '',
      notes: '',
      avatar_url: '' as string
  });

  const [subForm, setSubForm] = useState({
      name: '',
      trade: '',
      street: '',
      zip: '',
      city: '',
      logo_url: '' as string,
      contacts: [] as any[] // { first_name, last_name, email, phone, department, notes }
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    // Optimistic cache load
    if (cache.current[activeTab]) {
        setData(cache.current[activeTab]);
    } else {
        setLoading(true); // Only show spinner if no cache
    }

    let query;
    if (activeTab === 'subcontractors') {
      query = supabase.from('subcontractors').select('*, contacts:subcontractor_contacts(*)');
    } else if (activeTab === 'employees') {
      query = supabase.from('crm_contacts').select('*').eq('type', 'employee');
    } else {
      query = supabase.from('crm_contacts').select('*').eq('type', 'owner');
    }

    const { data: res, error } = await query;
    if (error) {
        console.error(error);
        showToast('Error loading data', 'error');
    } else {
        // Sort alphabetically
        const sorted = (res || []).sort((a: any, b: any) => {
             const nameA = a.company_name || a.first_name || a.name || '';
             const nameB = b.company_name || b.first_name || b.name || '';
             return nameA.localeCompare(nameB);
        });
        setData(sorted);
        cache.current[activeTab] = sorted;
    }
    setLoading(false);
  };

  const handleOpenCreate = () => {
      setSelectedItem(null);
      setIsEditing(false); // Create mode
      resetForms();
      setIsModalOpen(true);
  };

  const handleOpenDetail = (item: any) => {
      setSelectedItem(item);
      setPersonForm({
          first_name: item.first_name || '',
          last_name: item.last_name || '',
          email: item.email || '',
          phone: item.phone || '',
          personal_number: item.personal_number || '',
          department: item.department || '',
          company_name: item.company_name || '',
          address: item.detailed_address || '', // Map detailed_address -> address for form
          notes: item.notes || '',
          avatar_url: item.avatar_url || ''
      });
      
      if (activeTab === 'subcontractors') {
          setSubForm({
              name: item.name || (item.company_name) || '',
              trade: item.trade || '',
              street: item.street || '',
              zip: item.zip || '',
              city: item.city || '',
              logo_url: item.logo_url || (item.profile_picture_url) || '',
              contacts: item.contacts || []
          });
      }

      setIsDetailOpen(true);
  };

  const resetForms = () => {
    setPersonForm({ first_name: '', last_name: '', email: '', phone: '', personal_number: '', department: '', company_name: '', address: '', notes: '', avatar_url: '' });
    setSubForm({ name: '', trade: '', street: '', zip: '', city: '', logo_url: '', contacts: [] });
  };

  const handleDelete = async (id: string) => {
      if (!confirm('Are you sure you want to delete this entry?')) return;
      
      const table = activeTab === 'subcontractors' ? 'subcontractors' : 'crm_contacts';
      const { error } = await supabase.from(table).delete().eq('id', id);
      
      if (error) {
          showToast('Error deleting: ' + error.message, 'error');
      } else {
          showToast('Deleted successfully', 'success');
          setIsDetailOpen(false);
          // Invalidate cache
          delete cache.current[activeTab];
          fetchData();
      }
  };

  const handleSave = async () => {
      try {
        if (activeTab === 'subcontractors') {
             // Validate
             if (!subForm.name && !subForm.trade) { showToast('Project/Company name is required', 'error'); return; }

             const payload = {
                 name: subForm.name, // new field name
                 company_name: subForm.name, // old field backup
                 trade: subForm.trade,
                 street: subForm.street,
                 zip: subForm.zip,
                 city: subForm.city,
                 logo_url: subForm.logo_url,
                 profile_picture_url: subForm.logo_url // backup
             };

             let subId;
             if (isEditing && selectedItem) {
                 const { error } = await supabase.from('subcontractors').update(payload).eq('id', selectedItem.id);
                 if (error) throw error;
                 subId = selectedItem.id;
             } else {
                 const { data, error } = await supabase.from('subcontractors').insert(payload).select().single();
                 if (error) throw error;
                 subId = data.id;
             }
             
             if (subForm.contacts.length > 0) {
                 const newContacts = subForm.contacts.filter(c => !c.id).map(c => ({
                     subcontractor_id: subId,
                     first_name: c.first_name,
                     last_name: c.last_name,
                     email: c.email,
                     phone: c.phone
                 }));
                 if (newContacts.length > 0) {
                     await supabase.from('subcontractor_contacts').insert(newContacts);
                 }
             }

        } else {
             // Person
             if (!personForm.first_name || !personForm.last_name) { showToast('Name is required', 'error'); return; }

             const payload = {
                 type: activeTab === 'employees' ? 'employee' : 'owner',
                 first_name: personForm.first_name,
                 last_name: personForm.last_name,
                 email: personForm.email,
                 phone: personForm.phone,
                 avatar_url: personForm.avatar_url,
                 // Specifics
                 personal_number: activeTab === 'employees' ? personForm.personal_number : null,
                 department: activeTab === 'employees' ? personForm.department : null,
                 company_name: activeTab === 'owners' ? personForm.company_name : null,
                 detailed_address: activeTab === 'owners' ? personForm.address : null,
                 notes: activeTab === 'owners' ? personForm.notes : null
             };

             if (isEditing && selectedItem) {
                 const { error } = await supabase.from('crm_contacts').update(payload).eq('id', selectedItem.id);
                 if (error) throw error;
             } else {
                 const { error } = await supabase.from('crm_contacts').insert(payload);
                 if (error) throw error;
             }
        }

        showToast('Saved successfully', 'success');
        setIsModalOpen(false);
        setIsDetailOpen(false);
        setIsEditing(false);
        // Invalidate cache and reload
        delete cache.current[activeTab];
        fetchData();
      } catch (err: any) {
          showToast(err.message, 'error');
      }
  };

  const openEdit = () => {
      setIsEditing(true);
      setIsDetailOpen(false); // Close detail, open edit
      setIsModalOpen(true);
  };

  const renderCard = (item: any) => {
      const title = activeTab === 'subcontractors' ? (item.name || item.company_name) : `${item.first_name} ${item.last_name}`;
      const subtitle = activeTab === 'subcontractors' ? item.trade : (activeTab === 'employees' ? item.department : item.company_name);
      // Fallback image
      const image = activeTab === 'subcontractors' ? (item.logo_url || item.profile_picture_url) : item.avatar_url; 
      
      return (
          <TouchableOpacity key={item.id} onPress={() => handleOpenDetail(item)}>
            <Card style={styles.card}>
                <View style={styles.cardHeader}>
                    {image ? (
                        <Image source={{ uri: image }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            {activeTab === 'employees' && <User size={24} color="#666" />}
                            {activeTab === 'owners' && <Building size={24} color="#666" />}
                            {activeTab === 'subcontractors' && <Hammer size={24} color="#666" />}
                        </View>
                    )}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{title}</Text>
                        {!!subtitle && <Text style={styles.cardSub}>{subtitle}</Text>}
                        {/* {activeTab === 'employees' && <Text style={styles.cardMeta}>#{item.personal_number}</Text>}
                        <Text style={styles.cardMeta}>{item.email}</Text> */}
                    </View>
                </View>
            </Card>
          </TouchableOpacity>
      );
  };

  return (
    <>
        <View style={styles.tabs}>
            {(['employees', 'owners', 'subcontractors'] as const).map(tab => (
                <TouchableOpacity 
                    key={tab} 
                    style={[styles.tab, activeTab === tab && styles.activeTab]}
                    onPress={() => setActiveTab(tab)}
                >
                    <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>

        <View style={styles.toolbar}>
            <Text style={styles.count}>{data.length} entries</Text>
            <Button onClick={handleOpenCreate}>Add New</Button>
        </View>

        {loading && !cache.current[activeTab] ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        ) : (
            <ScrollView contentContainerStyle={styles.grid}>
                {data.map(renderCard)}
                {data.length === 0 && !loading && <Text style={styles.empty}>No records found.</Text>}
            </ScrollView>
        )}

        {/* CREATE / EDIT MODAL */}
        <ModernModal 
            visible={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            title={isEditing ? "Edit Entry" : "Create New Entry"}
        >
            <ScrollView style={{ maxHeight: 600 }}>
                <View style={styles.form}>
                    {activeTab !== 'subcontractors' ? (
                        <>
                             <ImageUploader 
                                label="Profile Picture" 
                                single 
                                value={personForm.avatar_url ? [personForm.avatar_url] : []}
                                onChange={(urls) => setPersonForm({...personForm, avatar_url: urls[0]})}
                                bucketName="avatars"
                            />
                            <View style={styles.row}>
                                <View style={{flex:1}}><Input label="First Name" value={personForm.first_name} onChangeText={t => setPersonForm({...personForm, first_name: t})} /></View>
                                <View style={{flex:1}}><Input label="Last Name" value={personForm.last_name} onChangeText={t => setPersonForm({...personForm, last_name: t})} /></View>
                            </View>
                            <Input label="Email" value={personForm.email} onChangeText={t => setPersonForm({...personForm, email: t})} />
                            <Input label="Phone" value={personForm.phone} onChangeText={t => setPersonForm({...personForm, phone: t})} />
                            
                            {activeTab === 'employees' && (
                                <>
                                    <Input label="Personal Number" value={personForm.personal_number} onChangeText={t => setPersonForm({...personForm, personal_number: t})} />
                                    <Input label="Department" value={personForm.department} onChangeText={t => setPersonForm({...personForm, department: t})} />
                                </>
                            )}
                            {activeTab === 'owners' && (
                                <>
                                    <Input label="Company Name (Optional)" value={personForm.company_name} onChangeText={t => setPersonForm({...personForm, company_name: t})} />
                                    <Input label="Detailed Address" value={personForm.address} onChangeText={t => setPersonForm({...personForm, address: t})} multiline />
                                    <Input label="Notes" value={personForm.notes} onChangeText={t => setPersonForm({...personForm, notes: t})} multiline />
                                </>
                            )}
                        </>
                    ) : (
                        <>
                             <ImageUploader 
                                label="Company Logo" 
                                single 
                                value={subForm.logo_url ? [subForm.logo_url] : []}
                                onChange={(urls) => setSubForm({...subForm, logo_url: urls[0]})}
                                bucketName="avatars" // Reuse avatars bucket or make new one
                            />
                            <Input label="Company Name" value={subForm.name} onChangeText={t => setSubForm({...subForm, name: t})} />
                            <Input label="Trade/Gewerke" value={subForm.trade} onChangeText={t => setSubForm({...subForm, trade: t})} />
                            <Input label="Street" value={subForm.street} onChangeText={t => setSubForm({...subForm, street: t})} />
                            <View style={styles.row}>
                                <View style={{flex:1}}><Input label="ZIP" value={subForm.zip} onChangeText={t => setSubForm({...subForm, zip: t})} /></View>
                                <View style={{flex:2}}><Input label="City" value={subForm.city} onChangeText={t => setSubForm({...subForm, city: t})} /></View>
                            </View>

                            <Text style={styles.sectionHeader}>Contacts</Text>
                            {/* Simple Contact Add for Subcontractors */}
                            <Button variant="outline" size="small" onClick={() => {
                                setSubForm({...subForm, contacts: [...subForm.contacts, { first_name: '', last_name: '', email: '' }]});
                            }}>+ Add Contact</Button>
                            
                            {subForm.contacts.map((c, i) => (
                                <View key={i} style={styles.contactRow}>
                                    <Input placeholder="First Name" value={c.first_name} onChangeText={t => {
                                        const newC = [...subForm.contacts]; newC[i].first_name = t; setSubForm({...subForm, contacts: newC});
                                    }} style={{flex:1}} />
                                    <Input placeholder="Last Name" value={c.last_name} onChangeText={t => {
                                        const newC = [...subForm.contacts]; newC[i].last_name = t; setSubForm({...subForm, contacts: newC});
                                    }} style={{flex:1}} />
                                     <Input placeholder="Email" value={c.email} onChangeText={t => {
                                        const newC = [...subForm.contacts]; newC[i].email = t; setSubForm({...subForm, contacts: newC});
                                    }} style={{flex:1}} />
                                </View>
                            ))}
                        </>
                    )}

                    <View style={styles.modalActions}>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)} style={{flex:1}}>Cancel</Button>
                        <Button onClick={handleSave} style={{flex:1}}>Save</Button>
                    </View>
                </View>
            </ScrollView>
        </ModernModal>
        
        {/* DETAIL POPUP */}
        {selectedItem && (
            <ModernModal visible={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="Details">
                <View style={styles.detailHeader}>
                    <TouchableOpacity onPress={openEdit} style={styles.iconBtn}><Edit2 size={20} color={colors.primary} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(selectedItem.id)} style={styles.iconBtn}><Trash2 size={20} color="red" /></TouchableOpacity>
                </View>
                
                <ScrollView style={{ maxHeight: 600 }}>
                     <View style={styles.detailContent}>
                         <View style={styles.detailHero}>
                            {((activeTab === 'subcontractors' ? (selectedItem.logo_url || selectedItem.profile_picture_url) : selectedItem.avatar_url)) ? (
                                <Image source={{ uri: (activeTab === 'subcontractors' ? (selectedItem.logo_url || selectedItem.profile_picture_url) : selectedItem.avatar_url) }} style={styles.detailImage} />
                            ) : (
                                <View style={[styles.detailImage, styles.avatarPlaceholder]}>
                                   <User size={40} color="#888" /> 
                                </View>
                            )}
                            <View>
                                <Text style={styles.detailTitle}>{activeTab === 'subcontractors' ? (selectedItem.name || selectedItem.company_name) : `${selectedItem.first_name} ${selectedItem.last_name}`}</Text>
                                <Text style={styles.detailSub}>{activeTab === 'subcontractors' ? selectedItem.trade : selectedItem.email}</Text>
                            </View>
                         </View>

                         <View style={styles.detailGrid}>
                             {Object.entries(activeTab === 'subcontractors' ? {
                                 "Address": selectedItem.street ? `${selectedItem.street}, ${selectedItem.zip} ${selectedItem.city}` : selectedItem.detailed_address,
                                 "Trade": selectedItem.trade
                             } : {
                                 "Phone": selectedItem.phone,
                                 "Personal #": selectedItem.personal_number,
                                 "Department": selectedItem.department,
                                 "Company": selectedItem.company_name,
                                 "Address": selectedItem.detailed_address,
                                 "Notes": selectedItem.notes
                             }).map(([key, val]) => val ? (
                                 <View key={key} style={styles.detailItem}>
                                     <Text style={styles.detailLabel}>{key}</Text>
                                     <Text style={styles.detailValue}>{val}</Text>
                                 </View>
                             ) : null)}
                         </View>
                         
                         {/* Contacts for Subcontractors */}
                         {activeTab === 'subcontractors' && selectedItem.contacts && selectedItem.contacts.length > 0 && (
                             <View style={{ marginTop: 20 }}>
                                 <Text style={styles.sectionHeader}>Contacts</Text>
                                 {selectedItem.contacts.map((c: any) => (
                                     <View key={c.id} style={styles.subContact}>
                                         <Text style={{fontWeight:'600'}}>{c.first_name} {c.last_name}</Text>
                                         <Text style={{fontSize:12, color: colors.textSecondary}}>{c.email} • {c.phone}</Text>
                                     </View>
                                 ))}
                             </View>
                         )}
                     </View>
                </ScrollView>
            </ModernModal>
        )}
    </>
  );
}

const styles = StyleSheet.create({
    tabs: { flexDirection: 'row', gap: 12, marginBottom: 24, paddingHorizontal: 4 },
    tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#f0f0f0' },
    activeTab: { backgroundColor: colors.primary },
    tabText: { fontWeight: '500', color: colors.textSecondary },
    activeTabText: { color: '#fff' },
    toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    count: { color: colors.textSecondary },
    grid: { gap: 12, paddingBottom: 40 },
    empty: { textAlign: 'center', marginTop: 40, color: colors.textSecondary },
    card: { padding: 12 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#eee' },
    avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontWeight: '600', fontSize: 16 },
    cardSub: { fontSize: 14, color: colors.textSecondary },
    form: { gap: 12 },
    row: { flexDirection: 'row', gap: 12 },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
    
    // Detail View
    detailHeader: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginBottom: 0 },
    iconBtn: { padding: 8, backgroundColor: '#f5f5f5', borderRadius: 8 },
    detailContent: { gap: 24, paddingBottom: 20 },
    detailHero: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    detailImage: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eee' },
    detailTitle: { fontSize: 24, fontWeight: 'bold' },
    detailSub: { fontSize: 16, color: colors.textSecondary },
    detailGrid: { gap: 16 },
    detailItem: { borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8 },
    detailLabel: { fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase' },
    detailValue: { fontSize: 16, marginTop: 4 },
    sectionHeader: { fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 8 },
    contactRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    subContact: { padding: 12, backgroundColor: '#f9f9f9', borderRadius: 8, marginBottom: 8 }
});

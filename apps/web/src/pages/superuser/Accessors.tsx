import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import { useLayout } from '../../layouts/LayoutContext';
import { Button, Input, Card } from '@docstruc/ui';
import { ModernModal } from '../../components/ModernModal';
import { ImageUploader } from '../../components/ImageUploader';
import { CountrySelect } from '../../components/CountrySelect';
import { PhoneInput } from '../../components/PhoneInput';
import { useToast } from '../../components/ToastProvider';
import { supabase } from '../../lib/supabase';
import { colors, spacing } from '@docstruc/theme';
import { Plus, Trash2, Edit2, User, Building, Hammer, Mail } from 'lucide-react';

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
      phone_country: 'DE',
      // Employee
      personal_number: '',
      department: '',
      // Owner
      company_name: '',
      street: '',
      zip: '',
      city: '',
      country: 'DE',
      notes: '',
      avatar_url: '' as string
  });

  const [subForm, setSubForm] = useState({
      name: '',
      trade: '',
      street: '',
      zip: '',
      city: '',
      country: 'DE',
      website: '',
      logo_url: '' as string,
      contacts: [] as any[] // { first_name, last_name, email, phone, phone_country, department, role }
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
              phone_country: item.phone_country || 'DE',
              personal_number: item.personal_number || '',
              department: item.department || '',
              company_name: item.company_name || '',
              street: item.street || '',
              zip: item.zip || '',
              city: item.city || '',
              country: item.country || 'DE',
              notes: item.notes || '',
              avatar_url: item.avatar_url || ''
          });      if (activeTab === 'subcontractors') {
          setSubForm({
              name: item.name || item.company_name || '',
              trade: item.trade || '',
              street: item.street || '',
              zip: item.zip || '',
              city: item.city || '',
              country: item.country || 'DE',
              website: item.website || '',
              logo_url: item.logo_url || item.profile_picture_url || '',
              contacts: item.contacts || []
          });
      }

      setIsDetailOpen(true);
  };

  const resetForms = () => {
      setPersonForm({ first_name: '', last_name: '', email: '', phone: '', phone_country: 'DE', personal_number: '', department: '', company_name: '', street: '', zip: '', city: '', country: 'DE', notes: '', avatar_url: '' });
      setSubForm({ name: '', trade: '', street: '', zip: '', city: '', country: 'DE', website: '', logo_url: '', contacts: [] });
  };  const handleDelete = async (id: string) => {
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
                 country: subForm.country,
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
             // Person (Employee or Owner)
             if (!personForm.first_name || !personForm.last_name) { showToast('Name is required', 'error'); return; }

             let payload: any = {
                 type: activeTab === 'employees' ? 'employee' : 'owner',
                 first_name: personForm.first_name,
                 last_name: personForm.last_name,
                 email: personForm.email,
                 phone: personForm.phone,
                 phone_country: personForm.phone_country,
                 avatar_url: personForm.avatar_url
             };

             // Add type-specific fields
             if (activeTab === 'employees') {
                 payload.personal_number = personForm.personal_number;
                 payload.department = personForm.department;
             } else if (activeTab === 'owners') {
                 payload.company_name = personForm.company_name;
                 payload.street = personForm.street;
                 payload.zip = personForm.zip;
                 payload.city = personForm.city;
                 payload.country = personForm.country;
                 payload.notes = personForm.notes;
             }

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
            title={
                isEditing 
                    ? `Edit ${activeTab === 'employees' ? 'Employee' : activeTab === 'owners' ? 'Owner' : 'Subcontractor'}`
                    : `Add New ${activeTab === 'employees' ? 'Employee' : activeTab === 'owners' ? 'Owner' : 'Subcontractor'}`
            }
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
                            <PhoneInput 
                                label="Phone"
                                placeholder="Phone number"
                                value={personForm.phone}
                                countryCode={personForm.phone_country}
                                onChangeText={(phone) => setPersonForm({...personForm, phone})}
                                onCountryChange={(code) => setPersonForm({...personForm, phone_country: code})}
                            />
                            
                            {activeTab === 'employees' && (
                                <>
                                    <Input label="Personal Number" value={personForm.personal_number} onChangeText={t => setPersonForm({...personForm, personal_number: t})} />
                                    <Input label="Department" value={personForm.department} onChangeText={t => setPersonForm({...personForm, department: t})} />
                                </>
                            )}
                            {activeTab === 'owners' && (
                                <>
                                    <Input label="Company Name (Optional)" value={personForm.company_name} onChangeText={t => setPersonForm({...personForm, company_name: t})} />
                                    <Input label="Street Address" value={personForm.street} onChangeText={t => setPersonForm({...personForm, street: t})} />
                                    <View style={styles.row}>
                                        <View style={{flex:1}}><Input label="ZIP Code" value={personForm.zip} onChangeText={t => setPersonForm({...personForm, zip: t})} /></View>
                                        <View style={{flex:2}}><Input label="City" value={personForm.city} onChangeText={t => setPersonForm({...personForm, city: t})} /></View>
                                    </View>
                                    <CountrySelect 
                                        label="Country" 
                                        value={personForm.country} 
                                        onChange={(code) => setPersonForm({...personForm, country: code})} 
                                    />
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
                            <CountrySelect 
                                label="Country" 
                                value={subForm.country} 
                                onChange={(code) => setSubForm({...subForm, country: code})} 
                            />
                            <Input label="Website" value={subForm.website} onChangeText={t => setSubForm({...subForm, website: t})} placeholder="https://example.com" />

                            <Text style={styles.sectionHeader}>Contacts</Text>
                            {/* Simple Contact Add for Subcontractors */}
                            <Button variant="outline" size="small" onClick={() => {
                                setSubForm({...subForm, contacts: [...subForm.contacts, { first_name: '', last_name: '', email: '', phone: '', phone_country: subForm.country, department: '', role: '' }]});
                            }}>+ Add Contact</Button>
                            
                            {subForm.contacts.map((c, i) => (
                                <View key={i} style={styles.contactBlock}>
                                    <View style={styles.contactHeader}>
                                        <Text style={styles.contactNumber}>Contact {i + 1}</Text>
                                        <TouchableOpacity 
                                            onPress={() => {
                                                const newC = subForm.contacts.filter((_, idx) => idx !== i);
                                                setSubForm({...subForm, contacts: newC});
                                            }}
                                            style={styles.deleteContactBtn}
                                        >
                                            <Trash2 size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.contactRow}>
                                        <Input placeholder="First Name" value={c.first_name} onChangeText={t => {
                                            const newC = [...subForm.contacts]; newC[i].first_name = t; setSubForm({...subForm, contacts: newC});
                                        }} style={{flex:1}} />
                                        <Input placeholder="Last Name" value={c.last_name} onChangeText={t => {
                                            const newC = [...subForm.contacts]; newC[i].last_name = t; setSubForm({...subForm, contacts: newC});
                                        }} style={{flex:1}} />
                                    </View>
                                    <Input placeholder="Email" value={c.email} onChangeText={t => {
                                        const newC = [...subForm.contacts]; newC[i].email = t; setSubForm({...subForm, contacts: newC});
                                    }} />
                                    <PhoneInput 
                                        placeholder="Phone number"
                                        value={c.phone || ''}
                                        countryCode={c.phone_country || subForm.country}
                                        onChangeText={(phone) => {
                                            const newC = [...subForm.contacts]; newC[i].phone = phone; setSubForm({...subForm, contacts: newC});
                                        }}
                                        onCountryChange={(code) => {
                                            const newC = [...subForm.contacts];
                                            newC[i].phone_country = code;
                                            setSubForm({...subForm, contacts: newC, country: code});
                                        }}
                                    />
                                    <Input placeholder="Department" value={c.department || ''} onChangeText={t => {
                                        const newC = [...subForm.contacts]; newC[i].department = t; setSubForm({...subForm, contacts: newC});
                                    }} />
                                    <Input placeholder="Role" value={c.role || ''} onChangeText={t => {
                                        const newC = [...subForm.contacts]; newC[i].role = t; setSubForm({...subForm, contacts: newC});
                                    }} />
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
                                 "Address": selectedItem.street ? `${selectedItem.street}, ${selectedItem.zip} ${selectedItem.city}${selectedItem.country ? ', ' + selectedItem.country : ''}` : '',
                                 "Trade": selectedItem.trade,
                                 "Website": selectedItem.website
                             } : {
                                 "Phone": selectedItem.phone,
                                 "Personal #": selectedItem.personal_number,
                                 "Department": selectedItem.department,
                                 "Company": selectedItem.company_name,
                                 "Address": selectedItem.street ? `${selectedItem.street}, ${selectedItem.zip} ${selectedItem.city}${selectedItem.country ? ', ' + selectedItem.country : ''}` : '',
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
                                         <View style={styles.contactInfoRow}>
                                             <View style={{ flex: 1 }}>
                                                 <Text style={{fontWeight:'700', fontSize: 15, marginBottom: 4}}>{c.first_name} {c.last_name}</Text>
                                                 {c.role && <Text style={{fontSize: 12, color: colors.textSecondary, marginBottom: 2}}>{c.role}</Text>}
                                                 {c.department && <Text style={{fontSize: 12, color: colors.textSecondary, marginBottom: 4}}>Department: {c.department}</Text>}
                                                 {c.phone && <Text style={{fontSize: 13, color: '#0f172a', marginBottom: 2}}>📞 {c.phone}</Text>}
                                             </View>
                                             {c.email && (
                                                 <TouchableOpacity 
                                                     style={styles.emailBtn}
                                                     onPress={() => Linking.openURL(`mailto:${c.email}`)}
                                                 >
                                                     <Mail size={18} color="#ffffff" />
                                                 </TouchableOpacity>
                                             )}
                                         </View>
                                         {c.email && <Text style={{fontSize: 13, color: '#0f172a', marginTop: 4}}>✉️ {c.email}</Text>}
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
    tabs: { 
        flexDirection: 'row', 
        gap: 8, 
        marginBottom: 24, 
        backgroundColor: '#FFFFFF', 
        borderRadius: 14, 
        padding: 6, 
        borderWidth: 1, 
        borderColor: '#F1F5F9',
        alignSelf: 'flex-start' as any,
    },
    tab: { 
        paddingVertical: 9, 
        paddingHorizontal: 20, 
        borderRadius: 10, 
    },
    activeTab: { 
        backgroundColor: colors.primary, 
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    tabText: { fontWeight: '600', color: '#94a3b8', fontSize: 14 },
    activeTabText: { color: '#fff' },
    toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    count: { color: '#94a3b8', fontWeight: '500', fontSize: 14 },
    grid: { gap: 8, paddingBottom: 40 },
    empty: { textAlign: 'center', marginTop: 40, color: '#94a3b8', fontWeight: '500' },
    card: { 
        padding: 14, 
        borderRadius: 14, 
        borderWidth: 1, 
        borderColor: '#F1F5F9',
        marginBottom: 2,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#F8FAFC' },
    avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
    cardTitle: { fontWeight: '700', fontSize: 15, color: '#0f172a', letterSpacing: -0.2 },
    cardSub: { fontSize: 13, color: '#94a3b8', fontWeight: '500', marginTop: 2 },
    form: { gap: 14 },
    row: { flexDirection: 'row', gap: 12 },
    modalActions: { 
        flexDirection: 'row', 
        gap: 12, 
        marginTop: 24,
        position: 'relative' as any,
        zIndex: 1,
    },
    
    // Detail View
    detailHeader: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginBottom: 0 },
    iconBtn: { 
        padding: 10, 
        backgroundColor: '#F8FAFC', 
        borderRadius: 10, 
        borderWidth: 1, 
        borderColor: '#F1F5F9' 
    },
    detailContent: { gap: 24, paddingBottom: 20 },
    detailHero: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 20, 
        paddingBottom: 20, 
        borderBottomWidth: 1, 
        borderBottomColor: '#F1F5F9' 
    },
    detailImage: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#F8FAFC' },
    detailTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
    detailSub: { fontSize: 15, color: '#94a3b8', fontWeight: '500', marginTop: 2 },
    detailGrid: { gap: 16 },
    detailItem: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 10 },
    detailLabel: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' as any, fontWeight: '700', letterSpacing: 0.5 },
    detailValue: { fontSize: 16, marginTop: 4, color: '#0f172a', fontWeight: '500' },
    sectionHeader: { fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 8, color: '#0f172a' },
    contactBlock: { marginBottom: 16, padding: 14, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    contactHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    contactNumber: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  contactRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    deleteContactBtn: { 
        padding: 10, 
        backgroundColor: '#FEE2E2', 
        borderRadius: 10, 
        justifyContent: 'center', 
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FECACA'
    },
    subContact: { 
        padding: 16, 
        backgroundColor: '#F8FAFC', 
        borderRadius: 12, 
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    contactInfoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    emailBtn: {
        backgroundColor: colors.primary,
        padding: 10,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
});

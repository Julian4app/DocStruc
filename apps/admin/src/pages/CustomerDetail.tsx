import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button, Input, CustomModal } from '@docstruc/ui';
import { TagInput } from '../components/TagInput';
import { colors } from '@docstruc/theme';

const TABS = ['General', 'Notes', 'Files', 'Subscription', 'History'];

// Simple Dropdown component mockup since we might not have one in @docstruc/ui
const Select = ({ label, value, options, onChange }: any) => (
    <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.selectWrapper}>
            <select 
                value={value} 
                onChange={(e) => onChange(e.target.value)}
                style={styles.selectInput}
            >
                <option value="">Select...</option>
                {options.map((o: any) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </View>
    </View>
);

const getStatusColor = (status: string) => {
    switch(status) {
        case 'Active': return { bg: '#D1FAE5', text: '#065F46' }; // Green
        case 'Inactive': return { bg: '#F3F4F6', text: '#374151' }; // Gray
        case 'Lead': return { bg: '#DBEAFE', text: '#1E40AF' }; // Blue
        case 'Paid': return { bg: '#D1FAE5', text: '#065F46' }; 
        case 'Open': return { bg: '#FEF3C7', text: '#92400E' }; // Yellow
        case 'Delayed': return { bg: '#FEE2E2', text: '#B91C1C' }; // Red
        default: return { bg: '#F3F4F6', text: '#374151' };
    }
};

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('General');
  
  // New Sub-Tab State
  const [subTab, setSubTab] = useState('General'); // General | Recipes | Payments

  const [loading, setLoading] = useState(true);
  
  // Data State
  const [company, setCompany] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [subTypes, setSubTypes] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  
  // Tags
  const [availableTags, setAvailableTags] = useState<any[]>([]);

  // UI State
  const [newNote, setNewNote] = useState('');
  const [newNoteTags, setNewNoteTags] = useState<string[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editNoteTags, setEditNoteTags] = useState<string[]>([]);
  
  // New Contact Modal State
  const [showContactModal, setShowContactModal] = useState(false);
  const [newContact, setNewContact] = useState({ first_name: '', surname: '', email: '', department: '' });

  useEffect(() => {
    if (id) {
        fetchData();
    }
  }, [id]);

  const fetchAvailableTags = async () => {
      const { data: tagData } = await supabase.from('tags').select('id, title, color');
      setAvailableTags(tagData || []);
  };

  const fetchData = async () => {
    try {
        setLoading(true);
        // 1. Fetch Company
        const { data: comp, error: compErr } = await supabase.from('companies').select('*').eq('id', id).single();
        if (compErr) throw compErr;
        setCompany(comp);

        // 2. Fetch Contacts (for dropdowns)
        const { data: cont } = await supabase.from('contact_persons').select('*');
        setContacts(cont || []);

        // 3. Fetch Subscription Types
        const { data: subs } = await supabase.from('subscription_types').select('*');
        setSubTypes(subs || []);

        // 4. Fetch Notes
        const { data: n } = await supabase.from('crm_notes').select('*').eq('company_id', id).order('created_at', { ascending: false });
        setNotes(n || []);

        // 5. Fetch Files
        const { data: f } = await supabase.from('company_files').select('*').eq('company_id', id);
        setFiles(f || []);
        
        // 6. Fetch Active Subscription
        const { data: s, error: subError } = await supabase.from('company_subscriptions').select('*').eq('company_id', id).maybeSingle();
        if (!subError) {
             setSubscription(s || { company_id: id }); 
        } else {
             // If error is other than not found (though maybeSingle handles 0 rows), log it
             console.log('Sub fetch error', subError);
             setSubscription({ company_id: id });
        }

        // 7. Fetch History
        const { data: h } = await supabase.from('company_history').select('*').eq('company_id', id).order('created_at', { ascending: false });
        // Use real history if available, else show a default 'Created' entry derived from company data
        const realHistory = h || [];
        if (realHistory.length === 0 && comp.created_at) {
             realHistory.push({ id: 'init', action: 'System', created_at: comp.created_at, details: 'Customer record created' });
        }
        setHistory(realHistory);

        // 8. Fetch Invoices
        const { data: inv } = await supabase.from('invoices').select('*').eq('company_id', id).order('due_date', { ascending: false });
        setInvoices(inv || []);

        // 9. Fetch Available Tags
        await fetchAvailableTags();

    } catch (e) {
        console.error(e);
        // navigate('/customers');
    } finally {
        setLoading(false);
    }
  };
  
  // Helper for History Logging
  const addToHistory = async (action: string, details: string) => {
      try {
          // Check if user table exists or just hardcode 'Admin' for now
          // We use 'System' or 'Admin' as default
          const { data, error } = await supabase.from('company_history').insert([{
              company_id: id,
              action,
              details,
              created_by: 'Admin' 
          }]).select().single();
          
          if (!error && data) {
              setHistory([data, ...history]);
          }
      } catch (e) {
          console.error('History log error', e);
      }
  };

  const handleUpdateCompany = async (updates: any) => {
      try {
          // Remove keys that cannot be updated directly or are joined
          const { id: _, created_at: __, ...updateFields } = updates;
          
          const { error } = await supabase.from('companies').update(updateFields).eq('id', id);
          if (error) throw error;
          
          setCompany({ ...company, ...updates });
          addToHistory('Company Updated', `Updated fields: ${Object.keys(updateFields).join(', ')}`);
          alert('Saved!');
      } catch (e) {
          console.error(e);
          alert('Error saving');
      }
  };

  const handleAddNote = async () => {
      if (!newNote.trim()) return;
      try {
          const { data, error } = await supabase.from('crm_notes').insert([
              { company_id: id, content: newNote, tags: newNoteTags }
          ]).select().single();
          if (error) throw error;
          setNotes([data, ...notes]);
          setNewNote('');
          setNewNoteTags([]);
          addToHistory('Note Added', 'New CRM note added');
      } catch (e) {
          console.error(e);
      }
  };

  const handleUpdateNote = async (noteId: string) => {
      try {
          const { error } = await supabase.from('crm_notes').update({ 
               content: editNoteContent, 
               tags: editNoteTags,
               updated_at: new Date() 
          }).eq('id', noteId);
          if (error) throw error;
          
          setNotes(notes.map(n => n.id === noteId ? { ...n, content: editNoteContent, tags: editNoteTags, updated_at: new Date() } : n));
          setEditingNoteId(null);
      } catch (e) {
          console.error(e);
          alert('Failed to update note');
      }
  };

  // Improved Uplod Handler using Supabase Storage
  const handlePickFile = async (bucket: string, folder: string, onUpload: (url: string) => void) => {
         const input = document.createElement('input');
        input.type = 'file';
        input.accept = '*/*';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;
            
            console.log('Starting upload...', file.name, 'to bucket', bucket);
            setLoading(true);
            try {
                // Prepare file path
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${folder}/${fileName}`;

                console.log('Uploading to:', filePath);
                const { data, error } = await supabase.storage.from(bucket).upload(filePath, file);

                if (error) {
                    console.error('Storage Upload Error:', error);
                    throw error;
                }

                console.log('Upload success, getting URL...');
                // Get Public URL
                const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
                
                console.log('File URL:', publicUrl);
                onUpload(publicUrl);
                alert('Upload successful');

            } catch (err: any) {
                console.error('Upload catch block:', err);
                alert(`Upload failed: ${err.message || JSON.stringify(err)}. Ensure bucket '${bucket}' exists and is public.`);
            } finally {
                setLoading(false);
            }
        };
        input.click();
  };
  
  const handleAddFile = async (url: string) => {
       // Insert into company_files table
       try {
           const fileName = url.split('/').pop() || 'File';
           const { data, error } = await supabase.from('company_files').insert([{
               company_id: id,
               file_url: url,
               file_name: fileName,
               tags: []
           }]).select().single();
           if (error) throw error;
           setFiles([...files, data]);
           addToHistory('File Uploaded', `Uploaded file: ${fileName}`);
       } catch(e) {
           console.error(e);
       }
  };

  const handleAddRecipe = async (url: string) => {
      // Recipe handling: Insert into company_files with tag 'Recipe'
       try {
           const fileName = url.split('/').pop() || 'Recipe';
           const { data, error } = await supabase.from('company_files').insert([{
               company_id: id,
               file_url: url,
               file_name: fileName,
               tags: ['Recipe']
           }]).select().single();
           if (error) throw error;
           setFiles([...files, data]); // Will update 'Recipes' tab view as filter
           addToHistory('Recipe Uploaded', `Uploaded recipe: ${fileName}`);
       } catch(e) {
           console.error(e);
       }
  };

  const handleUpdateInvoice = async (invoiceId: string, updates: any) => {
      try {
           const { error } = await supabase.from('invoices').update(updates).eq('id', invoiceId);
           if (error) throw error;
           // Update local state
           setInvoices(invoices.map(i => i.id === invoiceId ? { ...i, ...updates } : i));
           if (updates.status) addToHistory('Invoice Updated', `Invoice status changed to ${updates.status}`);
           alert('Invoice Updated');
      } catch (e) {
           console.error(e);
           alert('Error updating invoice');
      }
  };

  const handleUpdateSubscription = async () => {
      try {
          const payload = {
              company_id: id,
              subscription_type_id: subscription.subscription_type_id,
              payment_cycle: subscription.payment_cycle,
              payment_deadline_days: subscription.payment_deadline_days,
          };
          
          let error;
          if (subscription.id) {
               const res = await supabase.from('company_subscriptions').update(payload).eq('id', subscription.id);
               error = res.error;
          } else {
               const res = await supabase.from('company_subscriptions').insert([payload]);
               error = res.error;
          }
          
          if (error) throw error;
          
          await addToHistory('Subscription Update', `Updated to ${subscription.subscription_type_id} - ${subscription.payment_cycle}`);
          
          // Auto-generate invoice if none exists for FUTURE
          // We check if there is an 'Open' invoice. If count is 0, we create one.
          const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('company_id', id).eq('status', 'Open');
          
          if (count === 0) {
                // Find price
                const type = subTypes.find(s => s.id === subscription.subscription_type_id);
                if (type) {
                     let amount = type.price;
                     if (subscription.payment_cycle === 'yearly') amount *= 12;
                     else if (subscription.payment_cycle === 'quarterly') amount *= 3;
                     
                     // Due Date
                     const due = new Date();
                     due.setDate(due.getDate() + (subscription.payment_deadline_days || 7));
                     
                     const { data: inv, error: invErr } = await supabase.from('invoices').insert([{
                         company_id: id,
                         amount: amount,
                         due_date: due.toISOString(),
                         status: 'Open',
                         tags: ['Subscription'],
                         notes: `Auto-generated for ${subscription.payment_cycle} ${type.title}`
                     }]).select().single();
                     
                     if (!invErr && inv) {
                         setInvoices([inv, ...invoices]);
                         addToHistory('Invoice Generated', `Auto-generated invoice #${inv.id} for $${amount}`);
                     }
                }
          }

          alert('Subscription updated!');
      } catch (e) {
          console.error(e);
          alert('Failed to update subscription');
      }
  };

  const handleCreateContact = async () => {
      if (!newContact.first_name || !newContact.surname) return alert('Name required');
      
      try {
          const { data, error } = await supabase.from('contact_persons').insert([{
              ...newContact,
              company: company.name // Link to this company by name
          }]).select().single();
          
          if (error) throw error;
          
          // Refresh contacts list
          setContacts([...contacts, data]);
          
          // Auto-select and link to company
          setCompany({ ...company, contact_person_id: data.id });
          await supabase.from('companies').update({ contact_person_id: data.id }).eq('id', id);
          
          setShowContactModal(false);
          setNewContact({ first_name: '', surname: '', email: '', department: '' });
          alert('Contact created and assigned!');
      } catch (e) {
          console.error(e);
          alert('Failed to create contact');
      }
  };

  if (loading) return <View style={{ padding: 40 }}><ActivityIndicator /></View>;
  if (!company) return <Text>Customer not found</Text>;

  const contactOptions = contacts.map(c => ({ label: `${c.first_name} ${c.surname} (${c.email})`, value: c.id }));
  const statusOptions = [{ label: 'Lead', value: 'Lead' }, { label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }];

  const statusStyle = getStatusColor(company.status);

  return (
    <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
            <Text style={styles.title}>{company.name}</Text>
            <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.badgeText, { color: statusStyle.text }]}>{company.status}</Text>
            </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
            {TABS.map(tab => (
                <TouchableOpacity 
                    key={tab} 
                    style={[styles.tab, activeTab === tab && styles.activeTab]}
                    onPress={() => setActiveTab(tab)}
                >
                    <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                </TouchableOpacity>
            ))}
        </View>

        <ScrollView style={styles.content}>
            {/* GENERAL TAB */}
            {activeTab === 'General' && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>General Information</Text>
                    <View style={styles.formGrid}>
                        <View style={styles.field}>
                            <Text style={styles.label}>Company Name</Text>
                            <Input value={company.name} onChangeText={(t) => setCompany({...company, name: t})} placeholder="Name" />
                        </View>
                        
                        {/* Address Split */}
                        <Text style={[styles.label, {marginTop: 8}]}>Address Details</Text>
                        <View style={styles.row}>
                             <View style={[styles.field, {flex: 2}]}>
                                <Input value={company.address || ''} onChangeText={(t) => setCompany({...company, address: t})} placeholder="Street" />
                             </View>
                             <View style={[styles.field, {flex: 1}]}>
                                <Input value={company.zip_code || ''} onChangeText={(t) => setCompany({...company, zip_code: t})} placeholder="ZIP" />
                             </View>
                        </View>
                        <View style={styles.row}>
                             <View style={[styles.field, {flex: 1}]}>
                                <Input value={company.city || ''} onChangeText={(t) => setCompany({...company, city: t})} placeholder="City" />
                             </View>
                             <View style={[styles.field, {flex: 1}]}>
                                <Input value={company.country || ''} onChangeText={(t) => setCompany({...company, country: t})} placeholder="Country" />
                             </View>
                        </View>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                                <Select label="Contact Person" value={company.contact_person_id || ''} options={contactOptions} onChange={(v: string) => setCompany({...company, contact_person_id: v})} />
                            </View>
                            <View style={{ marginBottom: 16, flexDirection: 'row', gap: 8 }}>
                                <Button onClick={() => setShowContactModal(true)} variant="primary">+ New</Button>
                                {company.contact_person_id && (
                                    <Button onClick={() => navigate(`/contacts/${company.contact_person_id}`)} variant="secondary">View</Button>
                                )}
                            </View>
                        </View>
                        
                        <Select label="Status" value={company.status} options={statusOptions} onChange={(v: string) => setCompany({...company, status: v})} />
                        
                        <View style={styles.row}>
                            <View style={[styles.field, { flex: 1 }]}>
                                <Text style={styles.label}>Registered Accounts</Text>
                                <Input value={String(company.employees_count || 0)} editable={false} style={{ backgroundColor: '#F3F4F6' }} />
                            </View>
                            <View style={[styles.field, { flex: 1 }]}>
                                <Text style={styles.label}>Bought Accounts</Text>
                                <Input value={String(company.bought_accounts || 0)} onChangeText={(t) => setCompany({...company, bought_accounts: parseInt(t) || 0})} placeholder="0" />
                            </View>
                        </View>
                        
                        <Select label="SuperUser" value={company.superuser_id || ''} options={contactOptions} onChange={(v: string) => setCompany({...company, superuser_id: v})} />

                        <View style={styles.field}>
                            <Text style={styles.label}>Customer Tags</Text>
                            <TagInput 
                                value={company.tags || []} 
                                onChange={(tags) => setCompany({...company, tags})} 
                                availableTags={availableTags}
                                onTagCreated={fetchAvailableTags}
                            />
                        </View>

                        <View style={styles.field}>
                             <Text style={styles.label}>Logo</Text>
                             <View style={{ gap: 8 }}>
                                 {company.logo_url && <img src={company.logo_url} style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 8, border: '1px solid #eee' }} />}
                                 <TouchableOpacity style={styles.uploadBox} onPress={() => handlePickFile('logos', 'companies', (url) => setCompany({...company, logo_url: url}))}>
                                     <Text style={{ color: '#6B7280' }}>{company.logo_url ? 'Change Logo' : 'Upload Logo'}</Text>
                                 </TouchableOpacity>
                             </View>
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Added On</Text>
                            <Text style={styles.readonlyText}>{new Date(company.created_at).toLocaleString()}</Text>
                        </View>
                    </View>
                    <View style={styles.actionRow}>
                        <Button onClick={() => handleUpdateCompany(company)} variant="primary">Save Changes</Button>
                    </View>
                </View>
            )}

            {/* NOTES TAB */}
            {activeTab === 'Notes' && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>CRM Notes</Text>
                    <View style={styles.noteInput}>
                        <Input 
                            value={newNote} 
                            onChangeText={setNewNote} 
                            placeholder="Write a note..." 
                        />
                        <View style={{ marginVertical: 8 }}>
                           <Text style={[styles.label, { marginBottom: 4 }]}>Tags</Text>
                           <TagInput 
                               value={newNoteTags} 
                               onChange={setNewNoteTags}
                               availableTags={availableTags}
                               placeholder="Add tags..."
                               onTagCreated={fetchAvailableTags}
                           />
                        </View>
                        <Button onClick={handleAddNote} variant="secondary" style={{ marginTop: 8 }}>Add Note</Button>
                    </View>
                    <View style={styles.notesList}>
                        {notes.length === 0 && <Text style={{ color: '#9CA3AF', fontStyle: 'italic' }}>No notes yet.</Text>}
                        {notes.map(note => (
                            <View key={note.id} style={styles.noteItem}>
                                {editingNoteId === note.id ? (
                                    <View style={{ gap: 8 }}>
                                        <Input value={editNoteContent} onChangeText={setEditNoteContent} multiline />
                                        <View>
                                            <TagInput 
                                                value={editNoteTags} 
                                                onChange={setEditNoteTags}
                                                availableTags={availableTags}
                                                onTagCreated={fetchAvailableTags}
                                            />
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <Button onClick={() => handleUpdateNote(note.id)} variant="primary">Save</Button>
                                            <Button onClick={() => setEditingNoteId(null)} variant="secondary">Cancel</Button>
                                        </View>
                                    </View>
                                ) : (
                                    <>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                             <Text style={styles.noteContent}>{note.content}</Text>
                                             <TouchableOpacity onPress={() => { 
                                                 setEditingNoteId(note.id); 
                                                 setEditNoteContent(note.content);
                                                 setEditNoteTags(note.tags || []);
                                             }}>
                                                 <Text style={{ color: colors.primary, fontSize: 12 }}>Edit</Text>
                                             </TouchableOpacity>
                                        </View>
                                        <View style={{ marginTop: 4 }}>
                                            <TagInput value={note.tags || []} onChange={() => {}} availableTags={availableTags} readonly />
                                        </View>
                                        <Text style={styles.noteDate}>{new Date(note.created_at).toLocaleString()}</Text>
                                    </>
                                )}
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* FILES TAB */}
            {activeTab === 'Files' && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Files</Text>
                    <TouchableOpacity style={styles.uploadBox} onPress={() => handlePickFile('company-files', 'general', handleAddFile)}>
                         <Text style={{ color: '#6B7280' }}>+ Upload New File</Text>
                    </TouchableOpacity>
                    <View style={styles.filesList}>
                        {files.filter(f => !f.tags?.includes('Recipe')).length === 0 && <Text style={{ color: '#9CA3AF' }}>No files uploaded.</Text>}
                        
                        {files.filter(f => !f.tags?.includes('Recipe')).map(f => (
                            <View key={f.id} style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text style={{ fontWeight: '500' }}>{f.file_name}</Text>
                                    <a href={f.file_url} target="_blank" style={{ color: colors.primary }}>Download</a>
                                </View>
                                <View>
                                    <TagInput 
                                        value={f.tags || []}
                                        onChange={async (newTags) => {
                                            const { error } = await supabase.from('company_files').update({ tags: newTags }).eq('id', f.id);
                                            if (!error) {
                                                setFiles(files.map(file => file.id === f.id ? { ...file, tags: newTags } : file));
                                            }
                                        }}
                                        availableTags={availableTags}
                                        onTagCreated={fetchAvailableTags}
                                    />
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* SUBSCRIPTION TAB (With SubTabs) */}
            {activeTab === 'Subscription' && (
                 <View style={styles.card}>
                    
                    {/* SubTabs Navigation */}
                    <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24, borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 8 }}>
                        {['General', 'Recipes', 'Payments'].map(st => (
                            <TouchableOpacity key={st} onPress={() => setSubTab(st)}>
                                <Text style={{ 
                                    fontWeight: subTab === st ? 'bold' : 'normal',
                                    color: subTab === st ? colors.primary : '#6B7280',
                                    paddingBottom: 4,
                                    borderBottomWidth: subTab === st ? 2 : 0,
                                    borderColor: colors.primary
                                }}>{st}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    
                    {subTab === 'General' && (
                        <View style={styles.formGrid}>
                            <Select 
                                label="Subscription Type" 
                                value={subscription?.subscription_type_id || ''} 
                                options={subTypes.map(s => ({ label: `${s.title} ($${s.price})`, value: s.id }))} 
                                onChange={(v: string) => setSubscription({...subscription, subscription_type_id: v})} 
                            />
                            
                            <Select 
                                label="Payment Cycle" 
                                value={subscription?.payment_cycle || 'monthly'} 
                                options={[{label:'Monthly', value:'monthly'}, {label:'Quarterly', value:'quarterly'}, {label:'Yearly', value:'yearly'}]} 
                                onChange={(v: string) => setSubscription({...subscription, payment_cycle: v})} 
                            />
                            
                            <View style={styles.field}>
                                <Text style={styles.label}>Payment Deadline (Days after 1st)</Text>
                                <Input value={String(subscription?.payment_deadline_days || 7)} onChangeText={(t) => setSubscription({...subscription, payment_deadline_days: parseInt(t)})} />
                            </View>
                            
                            <View style={styles.highlightBox}>
                                <Text style={styles.highlightLabel}>Next Invoice Amount</Text>
                                <Text style={styles.highlightValue}>
                                    {(() => {
                                        const type = subTypes.find(s => s.id === subscription?.subscription_type_id);
                                        if (!type) return '$0.00';
                                        let price = type.price;
                                        if (subscription?.payment_cycle === 'yearly') price *= 12;
                                        if (subscription?.payment_cycle === 'quarterly') price *= 3;
                                        return `$${price.toFixed(2)}`;
                                    })()} 
                                </Text>
                                <Text style={styles.highlightSub}>Will be generated on {new Date().toLocaleDateString()}</Text>
                            </View>
                            <View style={styles.actionRow}>
                                <Button onClick={handleUpdateSubscription} variant="primary">Update Subscription</Button>
                            </View>
                        </View>
                    )}

                    {subTab === 'Recipes' && (
                        <View>
                             <TouchableOpacity style={styles.uploadBox} onPress={() => handlePickFile('company-files', 'recipes', handleAddRecipe)}>
                                 <Text style={{ color: '#6B7280' }}>+ Upload New Recipe PDF</Text>
                             </TouchableOpacity>
                             <View style={{ marginTop: 16 }}>
                                {files.filter(f => f.tags?.includes('Recipe')).length === 0 && <Text style={{ color: '#9CA3AF' }}>No recipes uploaded.</Text>}
                                {files.filter(f => f.tags?.includes('Recipe')).map(f => (
                                    <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, marginBottom: 8 }}>
                                        <View>
                                            <Text style={{ fontWeight: '600' }}>{f.file_name}</Text>
                                            <Text style={{ fontSize: 12, color: '#6B7280' }}>Uploaded: {new Date(f.uploaded_at || Date.now()).toLocaleDateString()}</Text>
                                            <View style={{ marginTop: 8 }}>
                                                <TagInput
                                                    value={f.tags || []} 
                                                    onChange={async (newTags) => {
                                                        // Ensure 'Recipe' tag stays if it's there? Or allow removing it?
                                                        // Strategy: Always ensure 'Recipe' is present if in this list
                                                        const safeTags = newTags.includes('Recipe') ? newTags : [...newTags, 'Recipe'];
                                                        const { error } = await supabase.from('company_files').update({ tags: safeTags }).eq('id', f.id);
                                                        if (!error) {
                                                            setFiles(files.map(file => file.id === f.id ? { ...file, tags: safeTags } : file));
                                                        }
                                                    }}
                                                    availableTags={availableTags}
                                                    onTagCreated={fetchAvailableTags}
                                                />
                                            </View>
                                        </View>
                                        <a href={f.file_url} target="_blank" style={{ color: colors.primary, fontWeight: '500' }}>Download</a>
                                    </View>
                                ))}
                             </View>
                        </View>
                    )}

                    {subTab === 'Payments' && (
                        <View>
                            <View style={styles.listHeader}>
                                <Text style={[styles.col, { flex: 1 }]}>Due Date</Text>
                                <Text style={[styles.col, { flex: 1 }]}>Amount</Text>
                                <Text style={[styles.col, { flex: 1 }]}>Status</Text>
                                <Text style={[styles.col, { flex: 2 }]}>Notes/Tags</Text>
                            </View>
                            {invoices.length === 0 && <Text style={{ fontStyle: 'italic', margin: 20 }}>No invoices found.</Text>}
                            
                            {invoices.map(inv => {
                                const statusColor = getStatusColor(inv.status);
                                return (
                                <View key={inv.id} style={styles.row}>
                                     <Text style={[styles.col, { flex: 1 }]}>{new Date(inv.due_date).toLocaleDateString()}</Text>
                                     <Text style={[styles.col, { flex: 1, fontWeight: 'bold' }]}>${inv.amount}</Text>
                                     <View style={{ flex: 1 }}>
                                         <View style={[styles.badge, { backgroundColor: statusColor.bg, alignSelf: 'flex-start' }]}>
                                             <select 
                                                 value={inv.status} 
                                                 onChange={(e) => handleUpdateInvoice(inv.id, { status: e.target.value })}
                                                 style={{ 
                                                     border: 'none', background: 'transparent', 
                                                     color: statusColor.text, fontWeight: '600', fontSize: 12, outline: 'none'
                                                  }}
                                             >
                                                 <option value="Open">Open</option>
                                                 <option value="Paid">Paid</option>
                                                 <option value="Delayed">Delayed</option>
                                                 <option value="Cancelled">Cancelled</option>
                                             </select>
                                         </View>
                                     </View>
                                     <View style={{ flex: 2, gap: 4 }}>
                                         <Input 
                                            value={inv.notes || ''} 
                                            onChangeText={(t) => setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, notes: t } : i))}
                                            onBlur={() => handleUpdateInvoice(inv.id, { notes: inv.notes })}
                                            placeholder="Note..." 
                                            style={{ height: 30, fontSize: 12 }}
                                         />
                                         <TagInput 
                                             value={inv.tags || []} 
                                             onChange={(newTags) => {
                                                 // Optimistic update
                                                 setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, tags: newTags } : i));
                                                 handleUpdateInvoice(inv.id, { tags: newTags });
                                             }}
                                             availableTags={availableTags}
                                             onTagCreated={fetchAvailableTags}
                                         />
                                     </View>
                                </View>
                            )})}
                        </View>
                    )}
                </View>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'History' && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>History</Text>
                    {history.map((item, idx) => (
                        <View key={idx} style={styles.historyItem}>
                             <View style={styles.historyTimeline} />
                             <View>
                                 <Text style={styles.historyAction}>{item.action}</Text>
                                 <Text style={styles.historyDetail}>{item.details}</Text>
                                 <Text style={styles.historyDate}>{new Date(item.created_at).toLocaleString()}</Text>
                             </View>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>

        {/* Create Contact Modal */}
        <CustomModal 
            visible={showContactModal} 
            onClose={() => setShowContactModal(false)}
            title="Add New Contact Person"
        >
            <View style={{ gap: 16, padding: 16 }}>
                <View style={{ gap: 8 }}>
                    <Text style={styles.label}>First Name *</Text>
                    <Input value={newContact.first_name} onChangeText={(t) => setNewContact({...newContact, first_name: t})} placeholder="John" />
                </View>
                <View style={{ gap: 8 }}>
                    <Text style={styles.label}>Surname *</Text>
                    <Input value={newContact.surname} onChangeText={(t) => setNewContact({...newContact, surname: t})} placeholder="Doe" />
                </View>
                <View style={{ gap: 8 }}>
                    <Text style={styles.label}>Email</Text>
                    <Input value={newContact.email} onChangeText={(t) => setNewContact({...newContact, email: t})} placeholder="john@example.com" />
                </View>
                <View style={{ gap: 8 }}>
                    <Text style={styles.label}>Department</Text>
                    <Input value={newContact.department} onChangeText={(t) => setNewContact({...newContact, department: t})} placeholder="Sales" />
                </View>
                <View style={{ gap: 8 }}>
                    <Text style={styles.label}>Company</Text>
                    <Input value={company.name} editable={false} style={{ backgroundColor: '#F3F4F6' }} />
                </View>
                <Button onClick={handleCreateContact} variant="primary" style={{ marginTop: 8 }}>Create & Assign</Button>
            </View>
        </CustomModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
    flex: 1,
  },
  header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 8
  },
  title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#111827'
  },
  badge: {
      backgroundColor: '#DBEAFE',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12
  },
  badgeText: {
      color: '#1E40AF',
      fontWeight: '600',
      fontSize: 12
  },
  tabsRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      gap: 32
  },
  tab: {
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      marginBottom: -1
  },
  activeTab: {
      borderBottomColor: colors.primary
  },
  tabText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#6B7280'
  },
  activeTabText: {
      color: colors.primary,
      fontWeight: '600'
  },
  content: {
      marginTop: 8,
      flex: 1
  },
  card: {
      backgroundColor: 'white',
      borderRadius: 16,
      padding: 32,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      marginBottom: 40
  },
  cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: 24
  },
  formGrid: {
      gap: 20
  },
  row: {
      flexDirection: 'row',
      gap: 24
  },
  field: {
      gap: 8,
      marginBottom: 16
  },
  label: {
      fontSize: 14,
      fontWeight: '500',
      color: '#374151'
  },
  readonlyText: {
      fontSize: 14,
      color: '#6B7280',
      paddingTop: 8
  },
  actionRow: {
      marginTop: 32,
      alignSelf: 'flex-end'
  },
  uploadBox: {
      borderWidth: 2,
      borderColor: '#E5E7EB',
      borderStyle: 'dashed',
      borderRadius: 8,
      height: 100,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F9FAFB'
  },
  selectWrapper: {
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 8,
      backgroundColor: 'white',
      overflow: 'hidden'
  },
  selectInput: {
      width: '100%',
      height: 48,
      paddingHorizontal: 12,
      border: 'none',
      backgroundColor: 'transparent',
      fontSize: 16,
      appearance: 'none', 
      outline: 'none'
  },
  noteInput: {
      marginBottom: 24
  },
  notesList: {
      gap: 16
  },
  noteItem: {
      padding: 16,
      backgroundColor: '#F3F4F6',
      borderRadius: 12
  },
  noteContent: {
      fontSize: 14,
      color: '#1F2937',
      marginBottom: 8
  },
  noteDate: {
      fontSize: 12,
      color: '#9CA3AF'
  },
  historyItem: {
      flexDirection: 'row',
      paddingBottom: 24,
      paddingLeft: 16,
      borderLeftWidth: 2,
      borderLeftColor: '#E5E7EB',
      marginLeft: 8,
      position: 'relative'
  },
  historyTimeline: {
      position: 'absolute',
      left: -5,
      top: 0,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#9CA3AF'
  },
  historyAction: {
      fontWeight: '600',
      color: '#111827'
  },
  historyDetail: {
      color: '#6B7280',
      marginBottom: 4
  },
  historyDate: {
      fontSize: 12,
      color: '#9CA3AF'
  },
  highlightBox: {
      backgroundColor: '#F0F9FF',
      borderRadius: 8,
      padding: 16,
      marginTop: 8
  },
  highlightLabel: {
      fontSize: 12,
      color: '#0369A1',
      fontWeight: '600'
  },
  highlightValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#0C4A6E',
      marginVertical: 4
  },
  highlightSub: {
      fontSize: 12,
      color: '#0369A1'
  }
});

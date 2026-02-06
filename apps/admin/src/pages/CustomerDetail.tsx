import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button, Input, CustomModal } from '@docstruc/ui';
import { TagInput } from '../components/TagInput';
import { Select } from '../components/Select';
import { colors } from '@docstruc/theme';
import { Building, Clock, Folder, Save, User, LayoutDashboard, FileText, History as HistoryIcon, CreditCard, ChevronDown, Upload, Trash2, Download } from 'lucide-react';

const TABS = [
  { id: 'General', label: 'Overview', icon: LayoutDashboard },
  { id: 'Notes', label: 'Notes', icon: FileText },
  { id: 'Files', label: 'Files', icon: Folder },
  { id: 'Subscription', label: 'Subscription', icon: CreditCard },
  { id: 'History', label: 'History', icon: HistoryIcon }
];

// Select component imported from ../components/Select

const getStatusColor = (status: string) => {
    switch(status) {
        case 'Active': return { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' };
        case 'Inactive': return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
        case 'Pending': return { bg: '#fef9c3', text: '#854d0e', border: '#fde047' };
        default: return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
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

  // Logo Modal
  const [showLogoModal, setShowLogoModal] = useState(false);

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

  const handleUpdateLogo = async (url: string) => {
      try {
           const { error } = await supabase.from('companies').update({ logo_url: url }).eq('id', id);
           if (error) throw error;
           setCompany({ ...company, logo_url: url });
           setShowLogoModal(false);
           addToHistory('Logo Updated', 'Company logo changed');
      } catch (e: any) {
           console.error(e);
           alert('Error updating logo');
      }
  };

  const handleRemoveLogo = async () => {
      try {
           const { error } = await supabase.from('companies').update({ logo_url: null }).eq('id', id);
           if (error) throw error;
           setCompany({ ...company, logo_url: null });
           setShowLogoModal(false);
           addToHistory('Logo Removed', 'Company logo removed');
      } catch (e) {
           console.error(e);
      }
  };

  if (loading) return <View style={{ padding: 40 }}><ActivityIndicator /></View>;
  if (!company) return <Text>Customer not found</Text>;

  const contactOptions = contacts.map(c => ({ label: `${c.first_name} ${c.surname} (${c.email})`, value: c.id }));
  const statusOptions = [{ label: 'Lead', value: 'Lead' }, { label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }];

  const statusStyle = getStatusColor(company.status);

  return (
    <View style={styles.container}>
        {/* Header Hero Section */}
        <View style={styles.header}>
            <View style={styles.headerTop}>
                {/* Logo & Name */}
                <View style={styles.logoRow}>
                    <TouchableOpacity onPress={() => setShowLogoModal(true)} style={styles.companyLogo}>
                        {company.logo_url ? (
                            <img src={company.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                            <View style={{ alignItems: 'center', gap: 4 }}>
                                <Upload size={24} color="#64748b" />
                                <Text style={{ fontSize: 10, color: '#94a3b8' }}>Upload</Text>
                            </View>
                        )}
                        <View style={styles.logoOverlay}>
                            <Text style={styles.logoOverlayText}>Edit</Text>
                        </View>
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.companyName}>{company.name}</Text>
                        <View style={styles.metaRow}>
                             <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
                                <View style={[styles.statusDot, { backgroundColor: statusStyle.border }]} />
                                <Text style={[styles.statusText, { color: statusStyle.text }]}>{company.status}</Text>
                             </View>
                             <Text style={styles.metaText}>{company.industry || 'Tech'} • Since {new Date(company.created_at).getFullYear()}</Text>
                        </View>
                    </View>
                </View>

                {/* Quick Stats or Actions */}
                <View style={styles.actionsBox}>
                    <Button variant="secondary" onClick={() => handleUpdateCompany(company)} style={{ height: 38 }}>
                        <Save size={16} /> Save Changes
                    </Button>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabsRow}>
                {TABS.map(tab => (
                    <TouchableOpacity 
                        key={tab.id} 
                        style={[styles.tab, activeTab === tab.id && styles.activeTab]}
                        onPress={() => setActiveTab(tab.id)}
                    >
                        <tab.icon size={16} color={activeTab === tab.id ? '#0f172a' : '#64748b'} />
                        <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>{tab.label}</Text>
                        {activeTab === tab.id && <View style={styles.activeLine} />}
                    </TouchableOpacity>
                ))}
            </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 60 }}>
            {/* OVERVIEW TAB */}
            {activeTab === 'General' && (
                <View style={styles.twoColumnGrid}>
                    <View style={styles.leftCol}>
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Company Details</Text>
                            </View>
                            <View style={styles.formStack}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Company Name</Text>
                                    <Input value={company.name} onChangeText={(t) => setCompany({...company, name: t})} />
                                </View>
                                <View style={styles.row}>
                                     <View style={{ flex: 2 }}>
                                        <Text style={styles.label}>Address</Text>
                                        <Input value={company.address || ''} onChangeText={(t) => setCompany({...company, address: t})} placeholder="Street" />
                                     </View>
                                     <View style={{ flex: 1 }}>
                                        <Text style={styles.label}>ZIP</Text>
                                        <Input value={company.zip_code || ''} onChangeText={(t) => setCompany({...company, zip_code: t})} placeholder="12345" />
                                     </View>
                                </View>
                                <View style={styles.row}>
                                     <View style={{ flex: 1 }}>
                                        <Input value={company.city || ''} onChangeText={(t) => setCompany({...company, city: t})} placeholder="City" />
                                     </View>
                                     <View style={{ flex: 1 }}>
                                        <Input value={company.country || ''} onChangeText={(t) => setCompany({...company, country: t})} placeholder="Country" />
                                     </View>
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Tags</Text>
                                    <TagInput 
                                        value={company.tags || []} 
                                        onChange={(tags) => setCompany({...company, tags})} 
                                        availableTags={availableTags}
                                        onTagCreated={fetchAvailableTags}
                                    />
                                </View>
                            </View>
                        </View>
                        
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Account Settings</Text>
                            </View>
                            <View style={styles.formStack}>
                                <View style={styles.row}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.label}>Employees (Reg.)</Text>
                                        <Input value={String(company.employees_count || 0)} editable={false} style={{ backgroundColor: '#f8fafc' }} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.label}>Purchased Users</Text>
                                        <Input value={String(company.bought_accounts || 0)} onChangeText={(t) => setCompany({...company, bought_accounts: parseInt(t) || 0})} />
                                    </View>
                                </View>
                                <Select label="Account Status" value={company.status} options={statusOptions} onChange={(v: string) => setCompany({...company, status: v})} />
                            </View>
                        </View>
                    </View>

                    <View style={styles.rightCol}>
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Key Contact</Text>
                                <TouchableOpacity onPress={() => setShowContactModal(true)}>
                                    <Text style={styles.linkText}>+ New</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{ marginBottom: 16 }}>
                                <Select label="Select Contact" value={company.contact_person_id || ''} options={contactOptions} onChange={(v: string) => setCompany({...company, contact_person_id: v})} />
                            </View>
                            
                            {/* Display Selected Contact Card */}
                            {company.contact_person_id && contacts.find(c => c.id === company.contact_person_id) && (
                                <View style={styles.contactCard}>
                                    <View style={styles.contactAvatar}>
                                        <User size={20} color="#64748b" />
                                    </View>
                                    <View>
                                        <Text style={styles.contactName}>{contacts.find(c => c.id === company.contact_person_id).first_name} {contacts.find(c => c.id === company.contact_person_id).surname}</Text>
                                        <Text style={styles.contactEmail}>{contacts.find(c => c.id === company.contact_person_id).email}</Text>
                                    </View>
                                </View>
                            )}
                        </View>
                        {/* History widget could go here too */}
                    </View>
                </View>
            )}

            {/* NOTES TAB */}
            {activeTab === 'Notes' && (
                <View style={styles.tabContainer}>
                    <View style={styles.notesInputCard}>
                        <Input 
                            value={newNote} 
                            onChangeText={setNewNote} 
                            multiline 
                            numberOfLines={3} 
                            placeholder="Write a note about this call or meeting..."
                            style={styles.notesArea}
                        />
                        <View style={styles.notesToolbar}>
                            <View style={{ width: 250 }}>
                                <TagInput 
                                    value={newNoteTags} 
                                    onChange={setNewNoteTags} 
                                    placeholder="Add tags..." 
                                    availableTags={availableTags}
                                />
                            </View>
                            <Button onClick={handleAddNote} variant="primary">Add Note</Button>
                        </View>
                    </View>

                    <View style={styles.notesList}>
                        {notes.map(note => (
                            <View key={note.id} style={styles.noteItem}>
                                <View style={styles.noteLeft}>
                                    <View style={styles.noteAvatar}>
                                        <Text style={styles.noteInitials}>AD</Text>
                                    </View>
                                    <View style={styles.line} />
                                </View>
                                <View style={styles.noteContent}>
                                    <View style={styles.noteHeader}>
                                        <Text style={styles.noteAuthor}>Admin</Text>
                                        <Text style={styles.noteTime}>{new Date(note.created_at).toLocaleString()}</Text>
                                    </View>
                                    <Text style={styles.noteText}>{note.content}</Text>
                                    {note.tags && note.tags.length > 0 && (
                                        <View style={styles.noteTags}>
                                            {note.tags.map((t: string) => (
                                                <View key={t} style={styles.miniTag}>
                                                    <Text style={styles.miniTagText}>{t}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* FILES TAB */}
            {activeTab === 'Files' && (
                <View style={styles.tabContainer}>
                    <View style={styles.emptyState}>
                        <Folder size={48} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>No files yet</Text>
                        <Text style={styles.emptyText}>Upload contracts, NDAs, or invoices here.</Text>
                        <Button variant="secondary" onClick={() => handlePickFile} style={{marginTop: 16}}>Upload File</Button>
                    </View>
                </View>
            )}

            {activeTab === 'History' && (
                 <View style={styles.card}>
                     <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Audit Log</Text>
                     </View>
                     {history.map((h, i) => (
                         <View key={i} style={styles.historyItem}>
                             <Clock size={16} color="#94a3b8" />
                             <View>
                                 <Text style={styles.historyAction}>{h.action}</Text>
                                 <Text style={styles.historyDetails}>{h.details}</Text>
                             </View>
                             <Text style={styles.historyTime}>{new Date(h.created_at).toLocaleDateString()}</Text>
                         </View>
                     ))}
                 </View>
            )}

             {/* SUBSCRIPTION TAB */}
            {activeTab === 'Subscription' && (
                 <View style={styles.twoColumnGrid}>
                     <View style={styles.leftCol}>
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>Current Plan</Text>
                                {subscription.subscription_type_id && (
                                    <View style={[styles.statusBadge, { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' }]}>
                                        <Text style={[styles.statusText, { color: '#166534' }]}>Active</Text>
                                    </View>
                                )}
                            </View>
                            
                            <View style={styles.formStack}>
                                <Select 
                                    label="Plan Type" 
                                    value={subscription.subscription_type_id} 
                                    options={subTypes.map(s => ({ label: `${s.title} ($${s.price})`, value: s.id }))}
                                    onChange={(v: string) => setSubscription({...subscription, subscription_type_id: v})}
                                />
                                
                                <View style={styles.row}>
                                    <View style={{ flex: 1 }}>
                                        <Select 
                                            label="Billing Cycle" 
                                            value={subscription.payment_cycle || 'monthly'} 
                                            options={[
                                                { label: 'Monthly', value: 'monthly' },
                                                { label: 'Quarterly', value: 'quarterly' },
                                                { label: 'Yearly', value: 'yearly' }
                                            ]}
                                            onChange={(v: string) => setSubscription({...subscription, payment_cycle: v})}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.label}>Payment Term (Days)</Text>
                                        <Input 
                                            value={String(subscription.payment_deadline_days || 14)} 
                                            onChangeText={(t) => setSubscription({...subscription, payment_deadline_days: parseInt(t) || 14})} 
                                            placeholder="14"
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>
                                
                                <View style={{ paddingTop: 16 }}>
                                    <Button onClick={handleUpdateSubscription} variant="primary">Update Subscription</Button>
                                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                                        Updating will update the next invoice generation settings.
                                    </Text>
                                </View>
                            </View>
                        </View>
                     </View>
                     
                     <View style={styles.rightCol}>
                         <View style={styles.card}>
                             <View style={styles.cardHeader}>
                                 <Text style={styles.cardTitle}>Last Invoices</Text>
                             </View>
                             <View style={{ gap: 12 }}>
                                 {invoices.length === 0 && <Text style={{ color: '#94a3b8', fontSize: 13 }}>No invoices yet.</Text>}
                                 {invoices.slice(0, 5).map(inv => (
                                     <View key={inv.id} style={styles.historyItem}>
                                         <View>
                                             <Text style={{ fontSize: 13, fontWeight: '600', color: '#0f172a' }}>#{inv.id.substring(0,8)}</Text>
                                             <Text style={{ fontSize: 12, color: '#64748b' }}>{new Date(inv.due_date).toLocaleDateString()}</Text>
                                         </View>
                                         <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
                                             <Text style={{ fontSize: 13, fontWeight: '600', color: '#0f172a' }}>${inv.amount}</Text>
                                             <View style={[
                                                 styles.miniTag, 
                                                 { backgroundColor: inv.status === 'Paid' ? '#dcfce7' : inv.status === 'Open' ? '#fef9c3' : '#fee2e2' }
                                             ]}>
                                                 <Text style={[
                                                     styles.miniTagText,
                                                     { color: inv.status === 'Paid' ? '#166534' : inv.status === 'Open' ? '#854d0e' : '#991b1b' }
                                                 ]}>{inv.status}</Text>
                                             </View>
                                         </View>
                                     </View>
                                 ))}
                             </View>
                         </View>
                     </View>
                 </View>
            )}

            {/* Create Contact Modal */}
            <CustomModal
                visible={showContactModal}
                onClose={() => setShowContactModal(false)}
                title="Create New Contact"
            >
                <View style={{ gap: 16, padding: 8 }}>
                    <Input value={newContact.first_name} onChangeText={t => setNewContact({...newContact, first_name: t})} placeholder="First Name" />
                    <Input value={newContact.surname} onChangeText={t => setNewContact({...newContact, surname: t})} placeholder="Surname" />
                    <Input value={newContact.email} onChangeText={t => setNewContact({...newContact, email: t})} placeholder="Email Address" />
                    <Input value={newContact.department} onChangeText={t => setNewContact({...newContact, department: t})} placeholder="Department / Role" />
                    
                    <Button onClick={handleCreateContact} variant="primary">Create Contact</Button>
                </View>
            </CustomModal>

            {/* Logo Modal */}
            <CustomModal
                visible={showLogoModal}
                onClose={() => setShowLogoModal(false)}
                title="Manage Logo"
            >
                <View style={{ gap: 16, padding: 8 }}>
                    <View style={{ alignItems: 'center', marginBottom: 16 }}>
                        {company.logo_url ? (
                            <img src={company.logo_url} style={{ width: 128, height: 128, objectFit: 'contain', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                        ) : (
                            <View style={{ width: 128, height: 128, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: 8 }}>
                                <Upload size={32} color="#cbd5e1" />
                            </View>
                        )}
                    </View>
                    
                    <Button 
                        variant="primary" 
                        onClick={() => handlePickFile('logos', 'public', (url) => handleUpdateLogo(url))}
                    >
                        <Upload size={16} style={{marginRight:8}} /> Upload New Logo
                    </Button>
                    
                    {company.logo_url && (
                        <Button 
                            variant="secondary" 
                            onClick={() => window.open(company.logo_url, '_blank')}
                        >
                            <Download size={16} style={{marginRight:8}} /> Download Current
                        </Button>
                    )}
                    
                    {company.logo_url && (
                        <Button 
                            variant="outline" 
                            onClick={handleRemoveLogo}
                            style={{ borderColor: '#ef4444' }}
                        >
                            <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Remove Logo</Text>
                        </Button>
                    )}
                </View>
            </CustomModal>

            {/* Logo Update Modal */}
            <CustomModal
                visible={showLogoModal}
                onClose={() => setShowLogoModal(false)}
                title="Update Company Logo"
            >
                <View style={{ gap: 16, padding: 8 }}>
                    <Text style={{ fontSize: 14, color: '#475569' }}>Change the company logo. Recommended size: 256x256px</Text>
                    
                    {/* Current Logo Preview */}
                    {company.logo_url && (
                        <View style={styles.logoPreview}>
                            <img src={company.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </View>
                    )}
                    
                    <Button variant="secondary" onClick={() => handlePickFile('logos', 'company_logos', handleUpdateLogo)} style={{ width: '100%' }}>
                        <Upload size={16} /> Upload New Logo
                    </Button>
                    
                    {company.logo_url && (
                        <Button variant="danger" onClick={handleRemoveLogo} style={{ width: '100%' }}>
                            <Trash2 size={16} /> Remove Logo
                        </Button>
                    )}
                </View>
            </CustomModal>
        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
    width: '100%',
    flex: 1,
    paddingBottom: 40
  },
  header: {
      backgroundColor: 'white',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      paddingTop: 24,
      paddingHorizontal: 24,
      gap: 24
  },
  headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
  },
  logoRow: {
      flexDirection: 'row',
      gap: 16,
      alignItems: 'center'
  },
  companyLogo: {
      width: 64,
      height: 64,
      borderRadius: 12,
      backgroundColor: '#f8fafc',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      alignItems: 'center',
      justifyContent: 'center'
  },
  companyName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#0f172a'
  },
  metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 4
  },
  metaText: {
      fontSize: 13,
      color: '#64748b'
  },
  statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 100,
      borderWidth: 1
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  
  actionsBox: {
      flexDirection: 'row',
      gap: 8
  },
  
  // Tabs
  tabsRow: {
      flexDirection: 'row',
      gap: 24,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9'
  },
  tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingBottom: 16,
      position: 'relative'
  },
  activeTab: {
  },
  tabText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#64748b'
  },
  activeTabText: {
      color: '#0f172a',
      fontWeight: '600'
  },
  activeLine: {
      position: 'absolute',
      bottom: -1,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: '#3b82f6',
      borderTopLeftRadius: 2,
      borderTopRightRadius: 2
  },
  
  content: {
      flex: 1
  },
  
  // Layout
  twoColumnGrid: {
      flexDirection: 'row',
      gap: 24,
      flexWrap: 'wrap'
  },
  leftCol: {
      flex: 2,
      gap: 24,
      minWidth: 400
  },
  rightCol: {
      flex: 1,
      gap: 24,
      minWidth: 300
  },
  
  // Card
  card: {
      backgroundColor: 'white',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      padding: 24,
      gap: 20,
      shadowColor: '#64748b',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8
  },
  cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8
  },
  cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#0f172a'
  },
  linkText: {
      color: '#3b82f6',
      fontSize: 14,
      fontWeight: '600'
  },
  
  // Forms
  formStack: { gap: 16 },
  row: { flexDirection: 'row', gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569' },
  
  // Select Custom
  selectWrapper: {
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 8,
      backgroundColor: 'white',
      height: 40,
      justifyContent: 'center',
      paddingHorizontal: 8
  },
  
  // Contact Card
  contactCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#f8fafc',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#e2e8f0'
  },
  contactAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      alignItems: 'center',
      justifyContent: 'center'
  },
  contactName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  contactEmail: { fontSize: 12, color: '#64748b' },

  // Notes
  tabContainer: {
      gap: 24
  },
  notesInputCard: {
      backgroundColor: 'white',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      padding: 16,
      gap: 16,
      shadowColor: '#64748b',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      marginBottom: 24
  },
  notesArea: {
      minHeight: 80,
      backgroundColor: '#f8fafc',
      borderWidth: 0,
      borderRadius: 8,
      padding: 12,
      fontSize: 14
  },
  notesToolbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginTop: 8
  },
  notesList: {
      gap: 20
  },
  noteItem: {
      flexDirection: 'row',
      gap: 16
  },
  noteLeft: {
      alignItems: 'center',
      width: 32
  },
  noteAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#3b82f6',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2
  },
  noteInitials: {
      color: 'white',
      fontSize: 11,
      fontWeight: '700'
  },
  line: {
      width: 2,
      flex: 1,
      backgroundColor: '#e2e8f0',
      marginTop: 4
  },
  noteContent: {
      flex: 1,
      backgroundColor: 'white',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      padding: 16,
      gap: 8
  },
  noteHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between'
  },
  noteAuthor: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  noteTime: { fontSize: 11, color: '#94a3b8' },
  noteText: { fontSize: 14, color: '#334155', lineHeight: 20 },
  noteTags: { flexDirection: 'row', gap: 6, marginTop: 4 },
  miniTag: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  miniTagText: { fontSize: 11, color: '#64748b', fontWeight: '500' },

  // Empty State
  emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 60,
      backgroundColor: 'white',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderStyle: 'dashed'
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#64748b', marginTop: 4 },

  // History
  historyItem: {
      flexDirection: 'row',
      gap: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f5f9',
      alignItems: 'flex-start'
  },
  historyAction: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  historyDetails: { fontSize: 13, color: '#64748b' },
  historyTime: { fontSize: 12, color: '#94a3b8', marginLeft: 'auto' },

  // Logo Preview
  logoPreview: {
      width: '100%',
      height: 150,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      backgroundColor: '#f8fafc',
      alignItems: 'center',
      justifyContent: 'center'
  }
});

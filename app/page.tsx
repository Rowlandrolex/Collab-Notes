'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  
  const [chatMessage, setChatMessage] = useState('');
  const [roomTopic, setRoomTopic] = useState('general');
  const [selectedLevel, setSelectedLevel] = useState('100');
  const [title, setTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [lecturer, setLecturer] = useState('');
  const [content, setContent] = useState('');
  
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  
  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Case-Insensitive Secretary General Admin Gate Checklist
  const currentUserEmail = user?.email?.toLowerCase() || '';
  const isSecretaryGeneral = currentUserEmail === 'rowland.eze.240759@unn.edu.ng' || currentUserEmail === 'rolexrowland@gmail.com';

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data: { user: serverUser } } = await supabase.auth.getUser();
        if (!serverUser) { router.push('/auth'); return; }
        setUser(serverUser);
      } else { setUser(session.user); }
      setLoading(false);
    };
    checkUser();
  }, [router]);
  useEffect(() => {
    if (!user) return;
    fetchNotes(selectedLevel);
    fetchMessages(roomTopic, selectedLevel);
    fetchAnnouncements(selectedLevel);
    if (isSecretaryGeneral) { fetchSuggestions(selectedLevel); }

    const instanceId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`room-${selectedLevel}-${roomTopic}-${instanceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'discussions', filter: `room_topic=eq.${roomTopic}` }, (payload) => {
        if (payload.new.student_level === selectedLevel) { setMessages((prev) => [payload.new, ...prev]); }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
        if (payload.new.student_level === selectedLevel) { setAnnouncements((prev) => [payload.new, ...prev]); }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomTopic, selectedLevel, user, isSecretaryGeneral]);

  const fetchNotes = async (level: string) => {
    const { data } = await supabase.from('notes').select('*').eq('student_level', level).order('created_at', { ascending: false });
    if (data) setNotes(data);
  };

  const fetchMessages = async (topic: string, level: string) => {
    const { data } = await supabase.from('discussions').select('*').eq('room_topic', topic).eq('student_level', level).order('created_at', { ascending: false });
    if (data) setMessages(data);
  };

  const fetchAnnouncements = async (level: string) => {
    const { data } = await supabase.from('announcements').select('*').eq('student_level', level).order('created_at', { ascending: false });
    if (data) setAnnouncements(data);
  };

  const fetchSuggestions = async (level: string) => {
    const { data } = await supabase.from('suggestions').select('*').eq('target_level', level).order('created_at', { ascending: false });
    if (data) setSuggestions(data);
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files;
    if (file.size > 50 * 1024 * 1024) {
      alert('Quota Restriction: File size exceeds the allowed maximum limit of 50MB.');
      e.target.value = '';
      return;
    }
    setUploadingFile(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${selectedLevel}/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('lecture-materials').upload(filePath, file);
    if (!uploadError) {
      const { data } = supabase.storage.from('lecture-materials').getPublicUrl(filePath);
      setFileUrl(data.publicUrl);
    } else { alert('Upload failed: ' + uploadError.message); }
    setUploadingFile(false);
  };

  const handleUploadNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('notes').insert([
      { user_id: user.id, title, course_code: courseCode, lecturer_name: lecturer, content, student_level: selectedLevel, file_url: fileUrl }
    ]);
    if (!error) { setTitle(''); setCourseCode(''); setLecturer(''); setContent(''); setFileUrl(''); fetchNotes(selectedLevel); }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    const profileName = user.user_metadata?.full_name || 'Registered Student';
    await supabase.from('discussions').insert([
      { user_id: user.id, message: chatMessage, room_topic: roomTopic, sender_name: profileName, student_level: selectedLevel }
    ]);
    setChatMessage('');
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementContent.trim()) return;
    const profileName = user.user_metadata?.full_name || 'Secretary-General';
    const { error } = await supabase.from('announcements').insert([
      { user_id: user.id, title: announcementTitle, content: announcementContent, sender_name: profileName, student_level: selectedLevel }
    ]);
    if (!error) { setAnnouncementTitle(''); setAnnouncementContent(''); fetchAnnouncements(selectedLevel); }
  };

  const handleSendSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionText.trim()) return;
    const { error } = await supabase.from('suggestions').insert([
      { suggestion: suggestionText, target_level: selectedLevel }
    ]);
    if (!error) { setSuggestionText(''); alert('Anonymous feedback delivered successfully!'); }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };
  if (loading) return <div className="p-8 text-center text-black">Loading Academic Hub...</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-black">
      <nav className="flex items-center justify-between bg-emerald-800 p-4 text-white shadow-md">
        <h1 className="text-xl font-bold tracking-wide text-white">Medical Radiography Hub</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium opacity-90">{user?.email}</span>
          <button onClick={handleSignOut} className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 transition">Sign Out</button>
        </div>
      </nav>

      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 flex justify-center space-x-2 md:space-x-4 py-3">
          {['100', '200', '300', '400', '500'].map((level) => (
            <button key={level} onClick={() => setSelectedLevel(level)} className={`px-4 py-2 rounded-lg font-bold text-sm transition-all duration-150 ${selectedLevel === level ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {level} Level
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-7xl p-6 space-y-6">
        {announcements.length > 0 && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800 mb-2">?? Official Secretary-General Bulletin ({selectedLevel}L)</h3>
            <div className="space-y-2">
              {announcements.map((ann) => (
                <div key={ann.id} className="border-b border-amber-200 pb-2 last:border-0 last:pb-0">
                  <h4 className="font-bold text-gray-900 text-md">{ann.title}</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{ann.content}</p>
                  <span className="text-[10px] text-amber-700 font-semibold mt-1 block">Broadcasted by {ann.sender_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6 lg:col-span-1">
            {isSecretaryGeneral && (
              <div className="bg-gradient-to-br from-amber-50 to-white p-6 rounded-xl shadow-md border border-amber-200">
                <h2 className="text-xl font-bold text-amber-900 mb-4">SG Broadcast Terminal ({selectedLevel}L)</h2>
                <form onSubmit={handlePostAnnouncement} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-amber-800">Bulletin Header Title</label>
                    <input type="text" required value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} className="mt-1 block w-full rounded border p-2 text-black border-amber-300 focus:outline-amber-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-amber-800">Official Announcement Circular Content</label>
                    <textarea required rows={3} value={announcementContent} onChange={(e) => setAnnouncementContent(e.target.value)} className="mt-1 block w-full rounded border p-2 text-black border-amber-300 focus:outline-amber-500 resize-none" />
                  </div>
                  <button type="submit" className="w-full rounded bg-amber-600 p-2 text-white font-medium hover:bg-amber-700 transition">Broadcast Official Release</button>
                </form>
              </div>
            )}

            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Form ({selectedLevel}L)</h2>
              <form onSubmit={handleUploadNote} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">Topic Title</label>
                  <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full rounded border p-2 text-black border-gray-300 focus:outline-emerald-500" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">Course Code</label>
                    <input type="text" required value={courseCode} onChange={(e) => setCourseCode(e.target.value)} className="mt-1 block w-full rounded border p-2 text-black border-gray-300 focus:outline-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">Lecturer</label>
                    <input type="text" value={lecturer} onChange={(e) => setLecturer(e.target.value)} className="mt-1 block w-full rounded border p-2 text-black border-gray-300 focus:outline-emerald-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">Key Concepts Summary</label>
                  <textarea required rows={3} value={content} onChange={(e) => setContent(e.target.value)} className="mt-1 block w-full rounded border p-2 text-black border-gray-300 focus:outline-emerald-500 resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">Attach Lecture Materials (Max 50MB)</label>
                  <input type="file" accept=".pdf,.docx,.doc,.pptx,.ppt,.jpg,.jpeg,.png" onChange={handleFileUpload} className="mt-1 block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
                  {uploadingFile && <p className="text-xs text-emerald-600 mt-1 animate-pulse">Uploading to cloud storage...</p>}
                  {fileUrl && <p className="text-xs text-green-600 mt-1">? Attached successfully!</p>}
                </div>
                <button type="submit" disabled={uploadingFile} className="w-full rounded bg-emerald-600 p-2 text-white font-medium hover:bg-emerald-700 transition disabled:bg-gray-400">Publish to {selectedLevel}L Stream</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-2">??? Anonymous Suggestion Box</h2>
              <p className="text-xs text-gray-500 mb-4">Have complaints or ideas for the department? Drop them here anonymously to inform the SG strategy planning panels.</p>
              <form onSubmit={handleSendSuggestion} className="space-y-3">
                <textarea required rows={2} value={suggestionText} onChange={(e) => setSuggestionText(e.target.value)} className="block w-full rounded border p-2 text-sm text-black border-gray-300 focus:outline-emerald-500 resize-none" placeholder="Type your concerns completely anonymously..." />
                <button type="submit" className="w-full rounded bg-gray-800 p-2 text-sm text-white font-medium hover:bg-gray-900 transition">Submit Safely</button>
              </form>
            </div>

              // Absolute Override: Unlocks the tools automatically for your account session layout
  const isSecretaryGeneral = user !== null && user !== undefined;
              <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4">?? Confidential Inbound Suggestion Logs ({selectedLevel}L)</h2>
                {suggestions.length === 0 ? (
                  <p className="text-sm text-gray-400">No suggestions received from this class level tier yet.</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                    {suggestions.map((sug) => (
                      <div key={sug.id} className="bg-gray-50 p-3 rounded-lg border text-sm text-gray-800">
                        <p>{sug.suggestion}</p>
                        <span className="text-[10px] text-gray-400 block mt-1">Received securely via level stream</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{selectedLevel} Level Study Stream</h2>
              {notes.length === 0 ? (
                <div className="bg-white p-6 rounded-xl text-center text-gray-400 border border-dashed border-gray-300">No lecture notes shared yet.</div>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                  {notes.map((note) => (
                    <div key={note.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                      <span className="inline-block bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded uppercase">{note.course_code}</span>
                      <h3 className="text-md font-bold text-gray-900 mt-1">{note.title} <span className="text-xs font-normal text-gray-500">by {note.lecturer_name}</span></h3>
                      <p className="text-gray-700 text-sm mt-1 whitespace-pre-line">{note.content}</p>
                      {note.file_url && (
)}

))}

)}
{selectedLevel}L Forum Room
<select value={roomTopic} onChange={(e) => setRoomTopic(e.target.value)} className="border rounded p-1 text-sm bg-gray-50 border-gray-300 text-black">
General Discussion
Radiographic Physics
Anatomy & Physiology

{messages.length === 0 ? (
Channel is quiet. Type a question below to consult peers!
) : (
messages.map((msg) => (

{msg.message}
{msg.sender_name || 'Registered Student'}

))
)}
<input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder={Message #${roomTopic}...} className="flex-1 rounded border p-2 text-sm border-gray-300 focus:outline-emerald-500 text-black" />
Send






);
}

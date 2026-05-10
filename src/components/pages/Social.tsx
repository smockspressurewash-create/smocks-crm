import React, { useState } from 'react';
import { Share2, Plus, Calendar, Clock, Image, Trash2, Heart, MessageSquare, Send, Globe, Star } from 'lucide-react';
import { Glass } from '../ui/Glass';
import { Badge } from '../ui/Badge';
import { GBtn } from '../ui/GBtn';
import { GInput } from '../ui/GInput';
import { GTxt } from '../ui/GTxt';
import { Modal } from '../ui/Modal';
import { uid, today } from '../../lib/utils';

export function SocialPage({ posts = [], setPosts, toast }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [newPost, setNewPost] = useState({ content: "", platform: "facebook", scheduledDate: today() });

  const addPost = () => {
    setPosts([...posts, { ...newPost, id: uid(), status: "scheduled", createdAt: today() }]);
    setShowAdd(false);
    toast("Post scheduled for " + newPost.scheduledDate);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2"><Share2 className="text-red-500" />Social Media</h2>
        <GBtn onClick={() => setShowAdd(true)} className="!text-xs"><Plus size={14} className="mr-1.5" />New Post</GBtn>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {posts.map((p: any) => (
          <Glass key={p.id} className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  {p.platform === "facebook" ? "f" : "i"}
                </div>
                <div>
                  <div className="text-xs font-bold uppercase">{p.platform}</div>
                  <div className="text-[10px] text-white/40">{p.scheduledDate}</div>
                </div>
              </div>
              <Badge tone={p.status === "scheduled" ? "yellow" : "green"}>{p.status}</Badge>
            </div>
            <p className="text-sm text-white/80 line-clamp-3 mb-4">{p.content}</p>
            <div className="flex gap-2">
              <GBtn variant="ghost" className="flex-1 !text-xs">Edit</GBtn>
              <GBtn variant="ghost" className="!px-3"><Trash2 size={14} /></GBtn>
            </div>
          </Glass>
        ))}
        {posts.length === 0 && <div className="lg:col-span-2 p-12 text-center text-white/20 italic">No social posts scheduled</div>}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Schedule Social Post">
        <div className="space-y-4">
          <div><label className="text-xs text-white/60 mb-1 block">Content</label><GTxt value={newPost.content} onChange={(e: any) => setNewPost({ ...newPost, content: e.target.value })} rows={4} placeholder="What's on your mind?" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Platform</label>
              <select className="w-full bg-black/40 border border-red-900/30 rounded-xl px-4 py-2.5 text-white" value={newPost.platform} onChange={(e: any) => setNewPost({ ...newPost, platform: e.target.value })}>
                <option value="facebook" className="bg-black">Facebook</option>
                <option value="instagram" className="bg-black">Instagram</option>
                <option value="google" className="bg-black">Google Business</option>
              </select>
            </div>
            <div><label className="text-xs text-white/60 mb-1 block">Date</label><GInput type="date" value={newPost.scheduledDate} onChange={(e: any) => setNewPost({ ...newPost, scheduledDate: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <GBtn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</GBtn>
            <GBtn onClick={addPost}>Schedule Post</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

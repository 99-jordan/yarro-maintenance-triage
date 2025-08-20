import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/api/supabaseAdapter';
import { ImageIcon, X } from 'lucide-react';

export default function AIHelpPanel({
  ticketId, tenantId, onNewMessage,
}: { ticketId: string; tenantId: string; onNewMessage: () => void; }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const ask = async () => {
    if (!text.trim() && !selectedImage) return;
    
    // Store the message text and clear input immediately
    const messageText = text.trim();
    setText('');
    removeImage();
    setSending(true);
    
    try {
      // First, save the tenant's message to the database
      const { data: { user } } = await supabase.auth.getUser();
      let imageUrl = null;

      // Upload image if selected
      if (selectedImage && user) {
        try {
          const fileName = `${user.id}/${ticketId}/${Date.now()}-${selectedImage.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('tenant-attachments')
            .upload(fileName, selectedImage, {
              cacheControl: '3600',
              upsert: false
            });
          
          if (uploadError) {
            console.error('Upload error:', uploadError);
            // For now, continue without image if upload fails due to RLS
            if (uploadError.message.includes('row-level security')) {
              toast({ 
                title: 'Image Upload Not Available', 
                description: 'Continuing with text-only message. Image uploads will be enabled soon.',
                variant: 'default' 
              });
              imageUrl = null; // Continue without image
            } else {
              toast({ 
                title: 'Image Upload Failed', 
                description: uploadError.message || 'Could not upload image',
                variant: 'destructive' 
              });
              return; // Don't proceed for other errors
            }
          } else if (uploadData) {
            const { data: urlData } = supabase.storage
              .from('tenant-attachments')
              .getPublicUrl(uploadData.path);
            imageUrl = urlData.publicUrl;
            console.log('Image uploaded successfully:', imageUrl);
          }
        } catch (error) {
          console.error('Upload exception:', error);
          toast({ 
            title: 'Upload Error', 
            description: 'Continuing with text-only message',
            variant: 'default' 
          });
          imageUrl = null; // Continue without image
        }
      }

      if (user) {
        // Get agency_id from the ticket
        const { data: ticket } = await supabase
          .from('tenant_tickets')
          .select('agency_id')
          .eq('id', ticketId)
          .single();
        
        if (ticket) {
          const messageBody = messageText + (imageUrl ? '' : ''); // Don't include image URL in text
          await supabase.from('tenant_messages').insert([{
            ticket_id: ticketId,
            agency_id: ticket.agency_id,
            sender_id: user.id,
            body: messageBody,
            is_system: false,
            meta: imageUrl ? { imageUrl } : {}
          }]);
        }
      }

      // Then call the AI
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/troubleshoot-lite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ticketId, 
          messageText: messageText || 'I have attached an image for you to analyze.',
          imageUrl 
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `AI error ${res.status}`);
      // Don't clear input here - already cleared above
      onNewMessage();
      // Scroll to bottom after AI response
      setTimeout(() => {
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 500); // Give more time for the AI message to render
    } catch (e: unknown) {
      toast({ title: 'Assistant error', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
        <div className="text-sm font-medium text-gray-700">AI Troubleshooter</div>
        <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
          GPT-4o {selectedImage ? 'Vision' : 'Mini'}
        </div>
      </div>
      
      {imagePreview && (
        <div className="relative inline-block">
          <img src={imagePreview} alt="Preview" className="max-w-32 max-h-32 rounded-xl border-2 border-indigo-200 shadow-sm" />
          <Button
            onClick={removeImage}
            size="sm"
            variant="destructive"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 shadow-md"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      
      <div className="flex gap-2">
        <Input 
          placeholder="Ask the AI for help or describe the issue..." 
          value={text} 
          onChange={e=>setText(e.target.value)} 
          className="flex-1 rounded-full border-gray-300 focus:border-purple-500 focus:ring-purple-500 bg-gray-50 focus:bg-white transition-colors"
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
          id={`image-upload-${ticketId}`}
        />
        <Button
          onClick={() => document.getElementById(`image-upload-${ticketId}`)?.click()}
          variant="outline"
          size="sm"
          className="rounded-full border-gray-300 hover:border-purple-500 hover:bg-purple-50"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button 
          onClick={ask} 
          disabled={sending || (!text.trim() && !selectedImage)}
          className="rounded-full px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-70"
        >
          {sending ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
              <span className="text-xs">AI is thinking...</span>
            </div>
          ) : (
            'Ask AI'
          )}
        </Button>
      </div>
    </div>
  );
}



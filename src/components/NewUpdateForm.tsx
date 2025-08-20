import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useApi } from '@/hooks/useApi';
import { Property, CreateUpdateInput } from '@/lib/api/types';
import { format } from 'date-fns';
import { Upload, X, FileText, DollarSign, Wrench, AlertTriangle, TrendingUp, Minus, Clock } from 'lucide-react';

const updateSchema = z.object({
  category: z.enum(['maintenance', 'rent', 'general']),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  eventDate: z.string(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  costPennies: z.number().optional(),
  sendNow: z.boolean()
});

type UpdateFormData = z.infer<typeof updateSchema>;

interface NewUpdateFormProps {
  property: Property;
  onSuccess: () => void;
  onCancel: () => void;
  variant?: 'card' | 'modal';
}

const NewUpdateForm = ({ property, onSuccess, onCancel, variant = 'card' }: NewUpdateFormProps) => {
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const api = useApi();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<UpdateFormData>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      eventDate: format(new Date(), 'yyyy-MM-dd'),
      priority: 'normal',
      sendNow: true
    }
  });

  const category = watch('category');
  const sendNow = watch('sendNow');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getTemplateText = (category: string) => {
    switch (category) {
      case 'maintenance':
        return 'Maintenance work has been completed at the property. All issues have been resolved and the property is in good condition.';
      case 'rent':
        return 'Monthly rent has been collected successfully. All payments are up to date.';
      case 'general':
        return 'General property update regarding recent activities and status.';
      default:
        return '';
    }
  };

  const onSubmit = async (data: UpdateFormData) => {
    setLoading(true);
    try {
      const input: CreateUpdateInput = {
        agencyId: property.agencyId,
        landlordId: property.landlordId,
        propertyId: property.id,
        category: data.category,
        title: data.title,
        description: data.description,
        eventDate: new Date(data.eventDate).toISOString(),
        status: 'open',
        priority: data.priority,
        costPennies: data.costPennies ? Math.round(data.costPennies * 100) : undefined
      };

      const result = await api.createUpdate(input, false);
      
      // Upload attachments after creating the update
      if (attachments.length > 0) {
        for (const file of attachments) {
          try {
            await api.uploadAttachment(file, result.update.id);
          } catch (error) {
            console.error('Failed to upload attachment:', error);
            toast({
              title: 'Upload Error',
              description: `Failed to upload ${file.name}`,
              variant: 'destructive'
            });
          }
        }
      }

      toast({
        title: 'Update Created',
        description: 'Property update has been created successfully.',
      });

      onSuccess();
    } catch (error) {
      console.error('Failed to create update:', error);
      toast({
        title: 'Error',
        description: 'Failed to create update. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'maintenance':
        return <Wrench className="h-4 w-4" />;
      case 'rent':
        return <DollarSign className="h-4 w-4" />;
      case 'general':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <TrendingUp className="h-4 w-4 text-orange-500" />;
      case 'normal':
        return <Minus className="h-4 w-4 text-blue-500" />;
      case 'low':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const content = (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={(value) => setValue('category', value as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="maintenance">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Maintenance
                </div>
              </SelectItem>
              <SelectItem value="rent">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Rent
                </div>
              </SelectItem>
              <SelectItem value="general">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  General
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-sm text-red-500">{errors.category.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select value={watch('priority')} onValueChange={(value) => setValue('priority', value as any)}>
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
          {errors.priority && (
            <p className="text-sm text-red-500">{errors.priority.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          {...register('title')}
          placeholder="Enter update title"
        />
        {errors.title && (
          <p className="text-sm text-red-500">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Enter update description"
          rows={4}
        />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="eventDate">Event Date</Label>
          <Input
            id="eventDate"
            type="date"
            {...register('eventDate')}
          />
          {errors.eventDate && (
            <p className="text-sm text-red-500">{errors.eventDate.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="costPennies">Cost (£)</Label>
          <Input
            id="costPennies"
            type="number"
            step="0.01"
            min="0"
            {...register('costPennies', { valueAsNumber: true })}
            placeholder="0.00"
          />
          {errors.costPennies && (
            <p className="text-sm text-red-500">{errors.costPennies.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <Label htmlFor="attachments">Attachments</Label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            id="attachments"
          />
          <label htmlFor="attachments" className="cursor-pointer">
            <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">Click to upload files</p>
          </label>
        </div>
        
        {attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="sendNow"
          checked={sendNow}
          onCheckedChange={(checked) => setValue('sendNow', checked as boolean)}
        />
        <Label htmlFor="sendNow">Send email immediately</Label>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Update'}
        </Button>
      </div>
    </form>
  );

  if (variant === 'modal') {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">New Property Update</h2>
          <p className="text-sm text-gray-600">Add a new update for {property.name}</p>
        </div>
        {content}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Property Update</CardTitle>
        <CardDescription>Add a new update for {property.name}</CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
};

export default NewUpdateForm;
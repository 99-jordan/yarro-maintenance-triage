import { 
  YarrowAPI, 
  Session, 
  Landlord, 
  Property, 
  Update, 
  CreateUpdateInput, 
  UpdateResult, 
  UpdateStatus,
  EmailResult,
  Attachment,
  ImportPreview,
  ImportResult,
  ColumnMapping
} from './types';

// Mock data
const mockSession: Session = {
  userId: 'user-1',
  agencyId: 'agency-1',
  token: 'mock-token-123',
  expiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
};

const mockLandlords: Landlord[] = [
  {
    id: 'landlord-1',
    agencyId: 'agency-1',
    name: 'Sarah Mitchell',
    email: 'sarah@example.com',
    phone: '+44 20 7123 4567',
    preferredChannel: 'email'
  },
  {
    id: 'landlord-2',
    agencyId: 'agency-1',
    name: 'David Johnson',
    email: 'david@example.com',
    phone: '+44 20 7234 5678',
    preferredChannel: 'email'
  },
  {
    id: 'landlord-3',
    agencyId: 'agency-1',
    name: 'Emma Wilson',
    email: 'emma@example.com',
    preferredChannel: 'email'
  }
];

const mockProperties: Property[] = [
  {
    id: 'property-1',
    agencyId: 'agency-1',
    landlordId: 'landlord-1',
    addressLine1: '45 Oak Street',
    city: 'Manchester',
    postcode: 'M1 2AB',
    notes: 'Victorian terrace, recently renovated'
  },
  {
    id: 'property-2',
    agencyId: 'agency-1',
    landlordId: 'landlord-1',
    addressLine1: '12 Elm Avenue',
    city: 'Birmingham',
    postcode: 'B2 3CD'
  },
  {
    id: 'property-3',
    agencyId: 'agency-1',
    landlordId: 'landlord-2',
    addressLine1: '78 Pine Road',
    city: 'Leeds',
    postcode: 'LS1 4EF'
  }
];

let mockUpdates: Update[] = [
  {
    id: 'update-1',
    agencyId: 'agency-1',
    landlordId: 'landlord-1',
    propertyId: 'property-1',
    category: 'maintenance',
    description: 'Boiler service completed. All systems working properly.',
    eventDate: new Date().toISOString(),
    status: 'resolved',
    costPennies: 15000,
    sentAt: new Date().toISOString(),
    sentChannel: 'email'
  },
  {
    id: 'update-2',
    agencyId: 'agency-1',
    landlordId: 'landlord-1',
    propertyId: 'property-1',
    category: 'rent',
    description: 'Monthly rent collected successfully.',
    eventDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'resolved',
    costPennies: 120000
  }
];

// Simulate API latency
const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

export const mockAdapter: YarrowAPI = {
  async signUp(email: string, password: string): Promise<void> {
    await delay();
    console.log('Mock: Sign up', { email, password });
    // Store mock session
    localStorage.setItem('yarrow-session', JSON.stringify(mockSession));
  },

  async signIn(email: string, password: string): Promise<void> {
    await delay();
    console.log('Mock: Sign in', { email, password });
    // Store mock session
    localStorage.setItem('yarrow-session', JSON.stringify(mockSession));
  },

  async signOut(): Promise<void> {
    await delay();
    console.log('Mock: Sign out');
    localStorage.removeItem('yarrow-session');
  },

  async getSession(): Promise<Session | null> {
    await delay(100);
    const stored = localStorage.getItem('yarrow-session');
    if (stored) {
      const session = JSON.parse(stored);
      // Check if expired
      if (new Date(session.expiry) > new Date()) {
        return session;
      }
      localStorage.removeItem('yarrow-session');
    }
    return null;
  },

  async listLandlords(search?: string): Promise<Landlord[]> {
    await delay();
    console.log('Mock: List landlords', { search });
    if (search) {
      return mockLandlords.filter(l => 
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.email.toLowerCase().includes(search.toLowerCase())
      );
    }
    return mockLandlords;
  },

  async listProperties(landlordId: string): Promise<Property[]> {
    await delay();
    console.log('Mock: List properties', { landlordId });
    return mockProperties.filter(p => p.landlordId === landlordId);
  },

  async createUpdate(input: CreateUpdateInput, sendNow?: boolean): Promise<UpdateResult> {
    await delay();
    console.log('Mock: Create update', { input, sendNow });
    
    const { attachments, ...updateData } = input;
    
    const update: Update = {
      ...updateData,
      id: `update-${Date.now()}`,
      sentAt: sendNow ? new Date().toISOString() : undefined,
      sentChannel: sendNow ? 'email' : undefined,
      attachments: attachments?.map((file, index) => ({
        id: `attachment-${Date.now()}-${index}`,
        updateId: `update-${Date.now()}`,
        filePath: `mock-storage/${file.name}`,
        filename: file.name,
        mimeType: file.type
      }))
    };
    
    mockUpdates.push(update);
    
    if (sendNow) {
      console.log('Mock: Email sent for update', update.id);
    }
    
    return {
      update,
      emailQueued: !!sendNow
    };
  },

  async updateStatus(updateId: string, status: UpdateStatus, notify?: boolean): Promise<void> {
    await delay();
    console.log('Mock: Update status', { updateId, status, notify });
    
    const update = mockUpdates.find(u => u.id === updateId);
    if (update) {
      update.status = status;
      if (notify) {
        console.log('Mock: Notification sent for status update', updateId);
      }
    }
  },

  async sendUpdate(updateId: string): Promise<EmailResult> {
    await delay();
    console.log('Mock: Send update', { updateId });
    
    const update = mockUpdates.find(u => u.id === updateId);
    if (update) {
      update.sentAt = new Date().toISOString();
      update.sentChannel = 'email';
    }
    
    return {
      updateId,
      success: true
    };
  },

  async listUpdates(propertyId: string): Promise<Update[]> {
    await delay();
    console.log('Mock: List updates', { propertyId });
    return mockUpdates
      .filter(u => u.propertyId === propertyId)
      .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
  },

  async uploadAttachment(file: File, updateId: string): Promise<Attachment> {
    await delay();
    console.log('Mock: Upload attachment', { filename: file.name, updateId });
    
    return {
      id: `attachment-${Date.now()}`,
      updateId,
      filePath: `mock-storage/${file.name}`,
      filename: file.name,
      mimeType: file.type
    };
  },

  async getSignedUrl(filePath: string, expiresIn?: number): Promise<string> {
    await delay(100);
    console.log('Mock: Get signed URL', { filePath, expiresIn });
    return `https://mock-storage.example.com/${filePath}?expires=${Date.now() + (expiresIn || 3600) * 1000}`;
  },

  async previewCSV(file: File): Promise<ImportPreview> {
    await delay();
    console.log('Mock: Preview CSV', { filename: file.name });
    
    return {
      rows: 25,
      landlordsDetected: 12,
      propertiesDetected: 18,
      duplicates: 2
    };
  },

  async importCSV(file: File, mappings: ColumnMapping[]): Promise<ImportResult> {
    await delay(2000); // Longer delay for import
    console.log('Mock: Import CSV', { filename: file.name, mappings });
    
    return {
      landlordsCreated: 10,
      propertiesCreated: 16,
      landlordsUpdated: 2
    };
  }
};
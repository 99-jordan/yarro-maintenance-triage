import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Property } from '@/lib/api/types';
import { Building2, MapPin, Plus, MessageSquare } from 'lucide-react';
import PropertyJournalModal from './PropertyJournalModal';

interface PropertyGridProps {
  properties: Property[];
  loading: boolean;
  landlordId: string;
}

const PropertyGrid = ({ properties, loading, landlordId }: PropertyGridProps) => {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  if (!landlordId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">Select a landlord</h3>
          <p>Choose a landlord from the sidebar to view their properties</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No properties found</h3>
          <p>This landlord doesn't have any properties yet</p>
          <Button className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Properties</h1>
          <p className="text-muted-foreground">
            {properties.length} {properties.length === 1 ? 'property' : 'properties'} found
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <Card key={property.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg flex items-start space-x-2">
                  <MapPin className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                  <div>
                    <div>{property.addressLine1}</div>
                    {property.addressLine2 && (
                      <div className="text-sm font-normal text-muted-foreground">
                        {property.addressLine2}
                      </div>
                    )}
                  </div>
                </CardTitle>
                <CardDescription>
                  {property.city}, {property.postcode}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {property.notes && (
                  <p className="text-sm text-muted-foreground">{property.notes}</p>
                )}
                
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="bg-success-light text-success">
                    2 Updates
                  </Badge>
                  <Badge variant="outline">
                    Active
                  </Badge>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    className="flex-1"
                    onClick={() => setSelectedProperty(property)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    View Journal
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {selectedProperty && (
        <PropertyJournalModal
          property={selectedProperty}
          isOpen={!!selectedProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}
    </>
  );
};

export default PropertyGrid;
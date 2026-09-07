import { useState } from 'react';
import { Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StoreDialog } from '../components/StoreDialog';
import { EmptyState, PageHeader, Panel } from '../components/shared';
import { useWorkspace } from '../hooks/useWorkspace';

export function StoreDetailsPage() {
    const { selectedStore, hasRole } = useWorkspace();
    const [editing, setEditing] = useState(false);

    if (!selectedStore)
        return (
            <EmptyState
                title="Chưa có quầy thuốc"
                description="Chọn quầy để xem thông tin."
            />
        );

    return (
        <div className="space-y-5">
            <PageHeader
                title="Thông tin quầy"
                description="Thông tin liên hệ của quầy đang làm việc."
                actions={
                    hasRole('owner') ? (
                        <Button onClick={() => setEditing(true)}>
                            <Edit3 />
                            Sửa thông tin
                        </Button>
                    ) : undefined
                }
            />
            <Panel className="p-4 sm:p-5">
                <dl className="grid gap-4 break-words sm:grid-cols-2">
                    <div>
                        <dt className="text-muted-foreground text-sm">
                            Tên quầy thuốc
                        </dt>
                        <dd className="mt-1 font-medium">
                            {selectedStore.name}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground text-sm">
                            Số điện thoại
                        </dt>
                        <dd className="mt-1">
                            {selectedStore.phone || 'Chưa có số điện thoại'}
                        </dd>
                    </div>
                    <div className="sm:col-span-2">
                        <dt className="text-muted-foreground text-sm">
                            Địa chỉ
                        </dt>
                        <dd className="mt-1">
                            {selectedStore.address || 'Chưa có địa chỉ'}
                        </dd>
                    </div>
                </dl>
            </Panel>
            {hasRole('owner') && (
                <StoreDialog
                    open={editing}
                    onOpenChange={setEditing}
                    store={selectedStore}
                />
            )}
        </div>
    );
}

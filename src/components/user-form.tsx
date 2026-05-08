
"use client";

import React, { useEffect, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff } from 'lucide-react';
import type { User, Role, PermissionId, Store } from '@/lib/types';
import { roles, permissions, rolePermissions, sanitizePermissions } from '@/lib/types';
import { DialogFooter } from './ui/dialog';
import { getStores } from '@/services/store-service';
import { MultiSelect } from './multi-select';

const userFormSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().optional(),
  role: z.string().min(1, 'Role is required'),
  pin: z.string().regex(/^\d{4}$|/, 'PIN must be 4 digits').optional(),
  isActive: z.boolean(),
  permissions: z.array(z.string()).refine(value => value.some(item => item), {
    message: 'You have to select at least one permission.',
  }),
  accessibleStoreIds: z.array(z.string()).optional(),
  defaultStoreId: z.string().optional(),
}).refine(data => {
    // If user is NOT Admin or Owner, they must have stores selected
    if (data.role !== 'Admin' && data.role !== 'Owner') {
        return data.accessibleStoreIds && data.accessibleStoreIds.length > 0 && data.defaultStoreId;
    }
    return true;
}, {
    message: 'A user must have at least one accessible store and a default store selected.',
    path: ['accessibleStoreIds'],
});


type UserFormValues = z.infer<typeof userFormSchema>;

function permissionsForForm(user: User): PermissionId[] {
  const cleaned = sanitizePermissions(user.permissions);
  let next = cleaned;
  // Pre-split accounts only had `pos`; show all three toggles checked until saved.
  if (next.includes('pos') && !next.includes('tables') && !next.includes('orders')) {
    next = [...next, 'tables', 'orders'];
  }
  return next.length > 0 ? next : rolePermissions[user.role];
}

interface UserFormProps {
  user?: User | null;
  onSave: (data: Partial<Omit<User, 'id'>>, userId?: string) => void;
  onCancel: () => void;
}

const defaultFormValues: UserFormValues = {
  fullName: '',
  username: '',
  password: '',
  role: 'Cashier',
  pin: '',
  isActive: true,
  permissions: rolePermissions.Cashier,
  accessibleStoreIds: [],
  defaultStoreId: '',
};

export function UserForm({ user, onSave, onCancel }: UserFormProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [allStores, setAllStores] = useState<Store[]>([]);

  useEffect(() => {
    getStores().then(setAllStores);
  }, []);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: user 
      ? {
          fullName: user.fullName,
          username: user.username,
          password: '',
          role: user.role,
          pin: user.pin,
          isActive: user.isActive,
          permissions: permissionsForForm(user),
          accessibleStoreIds: user.accessibleStoreIds || [],
          defaultStoreId: user.defaultStoreId || '',
        }
      : defaultFormValues,
  });

  const selectedRole = form.watch('role') as Role;
  const isAdminOrOwner = selectedRole === 'Admin' || selectedRole === 'Owner';

  useEffect(() => {
    // When switching from editing a user to adding one, reset the form.
    if (!user) {
      form.reset(defaultFormValues);
    } else {
       form.reset({
        fullName: user.fullName,
        username: user.username,
        password: '',
        role: user.role,
        pin: user.pin,
        isActive: user.isActive,
        permissions: permissionsForForm(user),
        accessibleStoreIds: user.accessibleStoreIds || [],
        defaultStoreId: user.defaultStoreId || '',
      });
    }
  }, [user, form]);


  useEffect(() => {
    if (form.formState.isDirty || !form.getValues('permissions')?.length) {
      form.setValue('permissions', rolePermissions[selectedRole], { shouldValidate: true });
    }
    
    if (isAdminOrOwner) {
        // If admin/owner, automatically give access to all stores
        const allStoreIds = allStores.map(s => s.id);
        form.setValue('accessibleStoreIds', allStoreIds);
        form.setValue('defaultStoreId', allStoreIds[0] || ''); // Set first store as default
    }
  }, [selectedRole, form, allStores, isAdminOrOwner]);


  const onSubmit: SubmitHandler<UserFormValues> = (data) => {
    let finalData = {...data};

    // If admin/owner, ensure they have all store IDs
    if(finalData.role === 'Admin' || finalData.role === 'Owner') {
        const allStoreIds = allStores.map(s => s.id);
        finalData.accessibleStoreIds = allStoreIds;
        finalData.defaultStoreId = allStoreIds[0] || '';
    }

    const userData: Partial<Omit<User, 'id'>> = {
      fullName: finalData.fullName,
      username: finalData.username,
      role: finalData.role as Role,
      pin: finalData.pin || '',
      isActive: finalData.isActive,
      permissions: sanitizePermissions(finalData.permissions),
      accessibleStoreIds: finalData.accessibleStoreIds,
      defaultStoreId: finalData.defaultStoreId,
    };
    
    if (finalData.password) {
      userData.password = finalData.password;
    }
    
    onSave(userData, user?.id);
  };
  
  const accessibleStoreIds = form.watch('accessibleStoreIds');
  const availableDefaultStores = allStores.filter(s => accessibleStoreIds?.includes(s.id));

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl><Input {...field} autoComplete="off" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl><Input {...field} autoComplete="off" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input type={showPassword ? 'text' : 'password'} placeholder={user ? "Leave empty to keep current" : "Enter password"} {...field} autoComplete="new-password"/>
                  </FormControl>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="pin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PIN Code</FormLabel>
                <FormControl><Input type="password" maxLength={4} {...field} autoComplete="off" /></FormControl>
                <FormDescription>Leave empty to disable PIN login.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Separator />
          
          {!isAdminOrOwner && (
            <>
                <FormField
                    control={form.control}
                    name="accessibleStoreIds"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Accessible Stores</FormLabel>
                        <MultiSelect
                            options={allStores.map(s => ({ value: s.id, label: s.name }))}
                            selected={field.value ?? []}
                            onChange={field.onChange}
                            className="w-full"
                        />
                        <FormDescription>Which stores can this user see and manage?</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="defaultStoreId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Default Store</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={!availableDefaultStores.length}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a default store" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {availableDefaultStores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                        <FormDescription>The store that loads when this user logs in.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <Separator />
            </>
          )}

          <FormField
            control={form.control}
            name="permissions"
            render={() => (
              <FormItem>
                <div className="mb-4">
                  <FormLabel className="text-base">Permissions</FormLabel>
                  <FormDescription>
                    Permissions are automatically set based on role, but can be overridden.
                  </FormDescription>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.values(permissions).map((permission) => (
                    <FormField
                      key={permission.id}
                      control={form.control}
                      name="permissions"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={permission.id}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(permission.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), permission.id])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== permission.id
                                        )
                                      )
                                }}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel className="font-normal">{permission.label}</FormLabel>
                                <FormDescription>{permission.description}</FormDescription>
                            </div>
                          </FormItem>
                        )
                      }}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <Separator />
          <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                      <FormLabel>Account Active</FormLabel>
                      <FormDescription>
                      Inactive accounts cannot log in to the system.
                      </FormDescription>
                  </div>
                  <FormControl>
                      <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      />
                  </FormControl>
                  </FormItem>
              )}
              />
            <DialogFooter>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </DialogFooter>
        </form>
      </Form>
    </>
  );
}

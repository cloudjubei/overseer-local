import React from 'react';

// Import UI components
import Button from './button';
import Spinner from './Spinner';
import Input from './Input';
import Tooltip from './Tooltip';
import Select from './select';
import Switch from './Switch';
import Skeleton from './Skeleton';
import SegmentedControl from './SegmentedControl';
import CollapsibleSidebar from './CollapsibleSidebar';
import Toast from './Toast';
import CommandMenu from './CommandMenu';
import ShortcutsHelp from './ShortcutsHelp';
import Alert from './Alert';
import Modal from './modal';

// Notes:
// - Each export is a small React component (preview) with sensible default props.
// - The preview runtime mounts by id=renderer/components/ui/previews.tsx#ExportName
// - Agents can override props via &props=... in the URL or preview_screenshot tool.
// - This avoids needing special provider plumbing per-component; core providers are already in preview mocks.

// Button
export function Button_Default(props: React.ComponentProps<typeof Button>) {
  return <Button {...props}>Click me</Button>;
}

export function Button_Variants() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 16 }}>
      <Button>Default</Button>
      <Button variant="primary">Primary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Delete</Button>
      <Button loading>Loading</Button>
      <Button disabled>Disabled</Button>
    </div>
  );
}

// Spinner
export function Spinner_Default(props: React.ComponentProps<typeof Spinner>) {
  return (
    <div style={{ padding: 24 }}>
      <Spinner {...props} />
    </div>
  );
}

// Input
export function Input_Default(props: React.ComponentProps<typeof Input>) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
      <Input placeholder="Type something..." {...props} />
      <Input prefixIcon="search" placeholder="Search" />
      <Input suffixIcon="calendar" placeholder="Due date" />
    </div>
  );
}

// Tooltip
export function Tooltip_Default() {
  return (
    <div style={{ padding: 40 }}>
      <Tooltip content="This is a tooltip">
        <Button>Hover me</Button>
      </Tooltip>
    </div>
  );
}

// Select
export function Select_Default(props: any) {
  const options = [
    { label: 'Option A', value: 'a' },
    { label: 'Option B', value: 'b' },
    { label: 'Option C', value: 'c' },
  ];
  return (
    <div style={{ padding: 16 }}>
      <Select options={options} value={props.value ?? 'a'} onChange={() => {}} />
    </div>
  );
}

// Switch
export function Switch_Default(props: React.ComponentProps<typeof Switch>) {
  return (
    <div style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
      <Switch checked {...props} />
      <Switch {...props} />
    </div>
  );
}

// Skeleton
export function Skeleton_Default() {
  return (
    <div style={{ padding: 16, width: 360, display: 'grid', gap: 8 }}>
      <Skeleton height={20} width={'60%'} />
      <Skeleton height={16} width={'80%'} />
      <Skeleton height={16} width={'90%'} />
      <Skeleton height={200} radius={8} />
    </div>
  );
}

// SegmentedControl
export function SegmentedControl_Default() {
  const segments = [
    { value: 'list', label: 'List' },
    { value: 'board', label: 'Board' },
  ];
  return (
    <div style={{ padding: 16 }}>
      <SegmentedControl value={'list'} onChange={() => {}} segments={segments} />
    </div>
  );
}

// CollapsibleSidebar
export function CollapsibleSidebar_Default() {
  return (
    <div style={{ height: 360, border: '1px solid var(--border-default)', display: 'flex' }}>
      <CollapsibleSidebar
        title="Navigation"
        items={[
          { id: 'tasks', label: 'Tasks' },
          { id: 'docs', label: 'Docs' },
          { id: 'chat', label: 'Chat' },
        ]}
        selectedId={'tasks'}
        onSelect={() => {}}
      />
      <div style={{ padding: 16, flex: 1 }}>Content area</div>
    </div>
  );
}

// Toast
export function Toast_Default() {
  return (
    <div style={{ padding: 16 }}>
      <Toast title="Saved" description="Your changes have been saved." variant="success" />
    </div>
  );
}

// CommandMenu
export function CommandMenu_Default() {
  return (
    <div style={{ padding: 16 }}>
      <CommandMenu
        open
        commands={[
          { id: 'new-task', label: 'New Task', shortcut: 'N' },
          { id: 'open-settings', label: 'Settings', shortcut: ',' },
        ]}
        onSelect={() => {}}
      />
    </div>
  );
}

// ShortcutsHelp
export function ShortcutsHelp_Default() {
  return (
    <div style={{ padding: 16 }}>
      <ShortcutsHelp
        sections={[
          {
            title: 'Navigation',
            shortcuts: [
              { keys: 'g t', label: 'Go to Tasks' },
              { keys: 'g d', label: 'Go to Docs' },
            ],
          },
          {
            title: 'Editing',
            shortcuts: [
              { keys: 'e', label: 'Edit' },
              { keys: '⌘S', label: 'Save' },
            ],
          },
        ]}
      />
    </div>
  );
}

// Alert
export function Alert_Default() {
  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <Alert title="Heads up" description="Something needs your attention." />
      <Alert variant="warning" title="Warning" description="This action is irreversible." />
      <Alert variant="error" title="Error" description="Something went wrong." />
      <Alert variant="success" title="Success" description="All good!" />
    </div>
  );
}

// Modal
export function Modal_Default() {
  return (
    <div style={{ padding: 16 }}>
      <Modal open title="Example Modal" onClose={() => {}}>
        <div style={{ padding: 16, display: 'grid', gap: 12 }}>
          <p>This is a modal body. Use onClose to wire up dismiss.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="ghost">Cancel</Button>
            <Button variant="primary">Confirm</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Named default mappings for convenience
export const ButtonPreview = Button_Default;
export const SpinnerPreview = Spinner_Default;
export const InputPreview = Input_Default;
export const TooltipPreview = Tooltip_Default;
export const SelectPreview = Select_Default;
export const SwitchPreview = Switch_Default;
export const SkeletonPreview = Skeleton_Default;
export const SegmentedControlPreview = SegmentedControl_Default;
export const CollapsibleSidebarPreview = CollapsibleSidebar_Default;
export const ToastPreview = Toast_Default;
export const CommandMenuPreview = CommandMenu_Default;
export const ShortcutsHelpPreview = ShortcutsHelp_Default;
export const AlertPreview = Alert_Default;
export const ModalPreview = Modal_Default;

export default Button_Default;

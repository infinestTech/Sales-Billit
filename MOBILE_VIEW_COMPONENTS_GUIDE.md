# Mobile View Components Guide

## Overview
Separate mobile-optimized components are now created for each section, rendered based on screen size. Desktop UI remains untouched.

## Architecture

### Component Structure
```
sales-frontend/
├── src/
│   ├── views/                      # Desktop views (unchanged)
│   │   ├── CreateBank.jsx
│   │   ├── InStockView.jsx
│   │   └── ...
│   ├── views/mobile/               # Mobile-optimized views (NEW)
│   │   ├── MobileCreateBank.jsx
│   │   ├── MobileInStock.jsx
│   │   └── ...
│   └── components/mobile/
│       ├── MobileViewRenderer.jsx  # Routes to correct mobile view
│       ├── MobileLayout.jsx        # Mobile app shell
│       └── MobileSidebar.jsx       # Mobile navigation
```

### How It Works

1. **Device Detection**: `useDeviceDetection` hook checks screen size
2. **Conditional Rendering**: main.jsx renders MobileLayout or desktop layout
3. **View Routing**: MobileViewRenderer maps views to mobile components
4. **Fallback**: If no mobile component exists, desktop component renders in mobile container

## Creating a New Mobile View

### Step 1: Create Mobile Component

Create a new file in `/src/views/mobile/Mobile[ViewName].jsx`:

```jsx
// Mobile-optimized [ViewName]
function Mobile[ViewName]({ salesUrl, token }) {
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  
  // Your component logic here
  
  return (
    <div className="mobile-content">
      {/* Mobile-friendly UI */}
      <div className="card mobile-mb-3">
        <div className="card-header">
          <h3 className="card-title">📱 Section Title</h3>
        </div>
        
        <div style={{ padding: '16px' }}>
          {/* Mobile content here */}
          <button className="btn btn-primary mobile-w-full">
            Action Button
          </button>
        </div>
      </div>
    </div>
  );
}

// Register globally
window.Mobile[ViewName] = Mobile[ViewName];
```

### Step 2: Add to index.html

Add the script tag in `/index.html`:

```html
<!-- Mobile view components -->
<script type="text/babel" data-presets="react" src="/src/views/mobile/MobileCreateBank.jsx"></script>
<script type="text/babel" data-presets="react" src="/src/views/mobile/MobileInStock.jsx"></script>
<script type="text/babel" data-presets="react" src="/src/views/mobile/Mobile[ViewName].jsx"></script> <!-- ADD THIS -->
```

### Step 3: Register in MobileViewRenderer

Update `/src/components/mobile/MobileViewRenderer.jsx`:

```jsx
const viewComponents = {
  'bank': window.MobileCreateBank,
  'instock': window.MobileInStock,
  'view-id': window.Mobile[ViewName], // ADD THIS
};
```

## Mobile Design Guidelines

### 1. Use Mobile Utility Classes

```jsx
// Full width on mobile
<button className="mobile-w-full">Save</button>

// Stack vertically on mobile
<div className="mobile-flex-col mobile-gap-2">
  <input />
  <input />
</div>

// Responsive spacing
<div className="mobile-mb-3 mobile-p-2">
  Content
</div>
```

### 2. Touch-Friendly Sizing

```jsx
// Minimum 44px touch targets
<button style={{ minHeight: '44px', padding: '12px 16px' }}>
  Tap Me
</button>

// 16px font to prevent iOS zoom
<input style={{ fontSize: '16px' }} />
```

### 3. Mobile-Optimized Cards

```jsx
<div style={{
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '12px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
}}>
  {/* Card content */}
</div>
```

### 4. Horizontal Scrolling for Tables

```jsx
<div className="mobile-overflow-x-auto">
  <table>
    {/* Table content */}
  </table>
</div>
```

### 5. Form Layout

```jsx
{/* Each input full width, stacked vertically */}
<div className="form-group mobile-mb-3">
  <label className="form-label">Field Name</label>
  <input className="form-input" />
</div>
```

## Currently Implemented Mobile Views

✅ **MobileCreateBank** - Bank account creation and listing
✅ **MobileInStock** - Product inventory management

## Views Pending Mobile Optimization

You can create mobile views for these as needed:

- [ ] MobileBankHistory
- [ ] MobileCreateSupplier
- [ ] MobileStockHistory
- [ ] MobileCreateBranch
- [ ] MobileBranchSupply
- [ ] MobileBranchSupplyHistory
- [ ] MobileProductSales
- [ ] MobileSecondsSales
- [ ] MobileSalesTrack
- [ ] MobileBranchExpense
- [ ] MobileGstCalculator

## Quick Template

Copy this template for new mobile views:

```jsx
function Mobile[ViewName]({ salesUrl, token }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  
  return (
    <div className="mobile-content">
      {/* Header Card */}
      <div className="card mobile-mb-3">
        <div className="card-header">
          <h3 className="card-title">🎯 View Title</h3>
          <p className="card-description">Description</p>
        </div>
        <div style={{ padding: '16px' }}>
          <button className="btn btn-primary mobile-w-full">
            Primary Action
          </button>
        </div>
      </div>

      {/* Content Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📋 Content Section</h3>
        </div>
        
        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <div className="empty-title">Loading...</div>
          </div>
        ) : error ? (
          <div className="alert alert-danger mobile-m-3">
            ⚠️ {error}
          </div>
        ) : (
          <div style={{ padding: '16px' }}>
            {/* Your content here */}
          </div>
        )}
      </div>
    </div>
  );
}

window.Mobile[ViewName] = Mobile[ViewName];
```

## Testing Your Mobile View

1. **Chrome DevTools**:
   - Press F12
   - Click device toolbar icon (Ctrl+Shift+M)
   - Select iPhone/Android device
   - Refresh page

2. **Responsive Sizes**:
   - iPhone SE: 375px
   - iPhone 12/13: 390px
   - Galaxy S21: 360px
   - iPad: 768px

3. **Test Checklist**:
   - [ ] All inputs are 16px font size
   - [ ] All buttons are full width
   - [ ] Forms stack vertically
   - [ ] Tables scroll horizontally
   - [ ] Touch targets are 44px minimum
   - [ ] No horizontal overflow

## Common Patterns

### List/Grid Items
```jsx
{items.map((item, idx) => (
  <div key={idx} style={{
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px'
  }}>
    <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
      {item.title}
    </h4>
    <p style={{ fontSize: '14px', color: '#64748b' }}>
      {item.description}
    </p>
  </div>
))}
```

### Action Sheet (Bottom Actions)
```jsx
<div style={{
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  background: '#fff',
  padding: '16px',
  borderTop: '1px solid #e5e7eb',
  boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
}}>
  <button className="btn btn-primary mobile-w-full">
    Save Changes
  </button>
</div>
```

### Empty States
```jsx
<div className="empty-state">
  <div className="empty-icon">📭</div>
  <div className="empty-title">No Items Found</div>
  <div className="empty-sub">Add your first item to get started</div>
  <button className="btn btn-primary" style={{ marginTop: '16px' }}>
    Add Item
  </button>
</div>
```

## Troubleshooting

### Component Not Loading
- Check if script tag is added to index.html
- Verify component is registered globally: `window.MobileComponentName`
- Check browser console for errors

### Desktop Showing on Mobile
- Verify device detection hook is working
- Check viewport meta tag in index.html
- Clear browser cache

### Styles Not Applying
- Ensure mobile utility classes are after base styles in CSS
- Check if `@media (max-width: 768px)` is applied
- Verify !important isn't needed for overrides

## Summary

✅ Desktop UI untouched - all existing views work as before
✅ Separate mobile components in `/src/views/mobile/`
✅ Automatic rendering based on screen size
✅ Easy to add new mobile views with template
✅ Fallback to desktop components if mobile not available
✅ Comprehensive mobile utility classes available

Create mobile views as needed - they'll automatically render on mobile devices!

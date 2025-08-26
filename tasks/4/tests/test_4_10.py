import os
import re

def test_autocomplete_implementation():
    file_path = 'src/renderer/screens/ChatView.tsx'
    assert os.path.exists(file_path), f'File {file_path} does not exist'
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Check for key states and functions
    assert 'docsList' in content, 'docsList state not found'
    assert 'isAutocompleteOpen' in content, 'isAutocompleteOpen state not found'
    assert 'matchingDocs' in content, 'matchingDocs state not found'
    assert 'mentionStart' in content, 'mentionStart state not found'
    assert 'autocompletePosition' in content, 'autocompletePosition state not found'
    assert 'updateDocsList' in content, 'updateDocsList function not found'
    assert 'extractPaths' in content, 'extractPaths function not found'
    assert 'checkForMention' in content, 'checkForMention function not found'
    assert 'getCursorCoordinates' in content, 'getCursorCoordinates function not found'
    assert 'handleSelect' in content, 'handleSelect function not found'
    
    # Check for subscription to docs updates
    assert 'window.docsIndex.subscribe' in content, 'Subscription to docs updates not found'
    
    # Check for autocomplete dropdown in JSX
    assert re.search(r'\{isAutocompleteOpen && autocompletePosition && \(', content), 'Autocomplete dropdown not found in JSX'
    
    print('All checks passed')
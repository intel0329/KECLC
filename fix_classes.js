const fs = require('fs');

try {
  const filepath = 'c:/Users/intel/Videos/xampp/htdocs/KECLC/src/components/PowerLoadContent.jsx';
  let orig = fs.readFileSync(filepath, 'utf-8');

  function replacer(match, pre, inner_text, post) {
      // Fix hyphens with spaces around them
      let fixed_text = inner_text.replace(/ \- /g, '-');
      // Fix slashes with spaces around them
      fixed_text = fixed_text.replace(/ \/ /g, '/');
      // Fix colons with a space after them (like focus: bg-red, hover: text-white)
      fixed_text = fixed_text.replace(/([a-zA-Z0-9_-]+):\s+/g, '$1:');
      return pre + fixed_text + post;
  }

  // Match className="..."
  orig = orig.replace(/(className=")([^"]+)(")/g, replacer);
  
  // Match className={`...`}
  orig = orig.replace(/(className=\{`)([^`]+)(`\})/g, replacer);

  fs.writeFileSync(filepath, orig, 'utf-8');
  console.log('Fix script applied successfully via Node.');
} catch (e) {
  console.error('Error:', e);
  process.exit(1);
}

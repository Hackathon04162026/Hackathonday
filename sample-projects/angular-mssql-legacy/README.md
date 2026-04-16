# Angular MS SQL Legacy

Legacy Angular sample with:
- Angular 8
- TypeScript 3.5
- RxJS 6 plus legacy UI helpers such as Bootstrap, jQuery, Lodash, Moment, and ngx-toastr
- MS SQL query artifact
- large UI branching, duplicated review rules, and embedded PII-like fields
- Node 12 and npm 6 engine hints to reinforce the older workspace shape

What the scanner should notice:
- legacy package versions that often need coordinated upgrade work
- direct use of customer names, account numbers, and support pins in UI logic
- hardcoded HTTP endpoints and debug-style tokens in helper code
- redundant branching in the status rules and payload builders
- SQL that selects sensitive customer fields directly
- outdated Angular, RxJS, TypeScript, and utility-library versions that should stand out in the report

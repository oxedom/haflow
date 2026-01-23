gh issue list

gh api graphql -F owner='guy-vaserman' -F repo='mono-mytrainingapp' -f query='
query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    issue(number: 106) {
      id
      number
      title
      body
      state
      projectItems(first: 1) {
        nodes {
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2FieldCommon { name } }
              }
            }
          }
        }
      }
    }
  }
}' | jq '
.data.repository.issue | 
{
  id, 
  number, 
  title, 
  body, 
  state 
} + (
  # This section extracts the custom fields and merges them to the top level
  .projectItems.nodes[0].fieldValues.nodes 
  | map(select(.name != null)) 
  | map({key: .field.name, value: .name}) 
  | from_entries
)'
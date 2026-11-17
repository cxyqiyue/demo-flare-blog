CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE post_categories (
  post_id INTEGER PRIMARY KEY NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  public_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL
);
CREATE INDEX post_categories_category_idx ON post_categories(category_id);
CREATE INDEX post_categories_public_category_idx ON post_categories(public_category_id);

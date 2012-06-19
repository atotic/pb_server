Sequel.migration do
	up do
		create_table(:books, :ignore_index_errors=>true) do
			primary_key :id
			DateTime :created_at
			DateTime :updated_at
			Integer :user_id, :null=>false
			String :title, :null=>false, :size=>255

			String :pdf_location, :size=>255
			String :pdf_generate_error, :size=>255
			TrueClass :pdf_generate_in_progress, :default=>false

			File :json_data, :size => :medium # book stored as json, :mediumblob size

			# Delete these when done
			String :page_order, :text=>true # comma separated list of page ids.
			String :template_name, :size=>255 # name of the template
			String :template, :text=>true 	# template attributes, stored as json

			index [:user_id], :name=>:index_books_user
		end

		create_table(:photos, :ignore_index_errors=>true) do
			primary_key :id
			DateTime :created_at
			DateTime :updated_at
			Integer :user_id, :null=>false

			String :display_name, :size=>128
			String :storage, :size=>128
			String :md5, :size=>128

			index [:user_id], :name=>:index_pb_photos_user
		end

		create_table(:book_pages, :ignore_index_errors=>true) do
			primary_key :id
			DateTime :created_at
			DateTime :updated_at
			String :html, :text=>true
			String :width, :size=>128
			String :height, :size=>128
			String :icon, :text=>true
			String :position, :size=>128
			Integer :book_id, :null=>false

			index [:book_id], :name=>:index_book_pages_book
		end

		create_table(:books_photos, :ignore_index_errors=>true) do
			Integer :photo_id, :null=>false
			Integer :book_id, :null=>false

			primary_key [:photo_id, :book_id]

			index [:book_id], :name=>:book_photos_book_fk
		end
	end

	down do
		drop_table(:book_pages, :book_photos, :books, :photos)
	end
end

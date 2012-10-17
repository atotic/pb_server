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

			Integer :last_diff
			File :document, :size => :medium # book stored as json, :mediumblob size

			# Delete these when done
			String :template_name, :size=>255 # name of the template
			String :template, :text=>true 	# template attributes, stored as json

			index [:user_id], :name=>:index_books_user
		end

		create_table(:photos, :ignore_index_errors=>true) do
			primary_key :id
			DateTime :created_at
			DateTime :updated_at
			Integer :user_id, :null=>false

			String :display_name, :size=>128	# Original file name
			String :md5, :size=>128

			# Exif data
			String :date_taken
			String :caption, :size=>256
			String :faces, :size=>256

			# Images
			String :original_file, :size=>128	# Original file
			Integer :original_file_width
			Integer :original_file_height
			String :display_file, :size=>128 # Display file (1024)
			Integer :display_file_width
			Integer :display_file_height
			String :icon_file, :size=>128 # Icon file (128)
			Integer :icon_file_width
			Integer :icon_file_height
			index [:user_id], :name=>:index_pb_photos_user
		end

		create_table(:books_photos, :ignore_index_errors=>true) do
			Integer :photo_id, :null=>false
			Integer :book_id, :null=>false

			primary_key [:photo_id, :book_id]

			index [:book_id], :name=>:book_photos_book_fk
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

	end

	down do
		drop_table(:book_pages, :book_photos, :books, :photos)
	end
end

Sequel.migration do
	up do
		create_table(:delayed_jobs, :ignore_index_errors=>true) do
			primary_key :id
			Integer :priority, :default=>0
			Integer :attempts, :default=>0
			String :handler, :text=>true
			DateTime :run_at
			DateTime :locked_at
			String :locked_by, :text=>true
			DateTime :failed_at
			String :last_error, :text=>true
			String :queue, :size=>128
			
			index [:locked_at], :name=>:index_delayed_jobs_locked_at
			index [:priority, :run_at], :name=>:index_delayed_jobs_run_at_priority
		end

		create_table(:chrome_pdf_tasks) do
			primary_key :id
			DateTime :created_at
			DateTime :updated_at
			String :book_dir, :size=>255
			String :book_pdf, :null=>false, :size=>255
			String :html_file, :null=>false, :size=>255
			String :pdf_file, :null=>false, :size=>255
			Integer :book_id, :null=>false
			String :html_file_url, :null=>false, :size=>255
			Integer :page_width, :null=>false
			Integer :page_height, :null=>false
			Integer :processing_stage, :default=>0
			TrueClass :has_error, :default=>false
			String :error_message, :size=>128
		end
	end
	down do
		drop_table(:delayed_jobs, :chrome_pdf_tasks)
	end
end

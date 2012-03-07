Sequel.migration do
	up do

		create_table(:users) do
			primary_key :id
			DateTime :created_at
			DateTime :updated_at
			String :display_name, :size=>128, :null=>false
			TrueClass :is_administrator, :default=>false
		end

		create_table(:auth_logins, :ignore_index_errors=>true) do
			String :login_id, :null=>false, :size=>128
			DateTime :created_at
			DateTime :updated_at
			DateTime :last_login
			Integer :user_id, :null=>false
			
			primary_key [:login_id]
			
			index [:user_id], :name=>:index_auth_logins_user
		end
		

		create_table(:server_commands, :ignore_index_errors=>true) do
			primary_key :id
			DateTime :created_at
			DateTime :updated_at
			String :payload, :text=>true # command-specific json payload
			String :type, :size=>128 # used by js to execute commands in browser
			Integer :book_id, :null=>false
			
			index [:book_id], :name=>:index_server_commands_book
		end
		
	end
	
	down do
		drop_table(:auth_logins, :server_commands, :users)
	end
end

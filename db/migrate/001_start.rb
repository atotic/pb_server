Sequel.migration do
	up do

		create_table(:users) do
			primary_key :id
			DateTime :created_at
			DateTime :updated_at
			String :display_name, :size=>128, :null=>false
			String :email, :size=>128
			TrueClass :is_administrator, :default=>false

			index [:email], :name => :index_users_email
		end

		create_table(:omniauth_tokens) do
			primary_key :id
			DateTime :created_at
			DateTime :updated_at
			Integer :user_id

			Integer :strategy # 0 developer, 1 facebook, 2 google
			String :strategy_uid, :null=>false, :size=>128 # unique user id per strategy
			String :auth_data, :text=>true # JSON created by omniauth

			index [:strategy], :name => :index_omniauth_strategy
			index [:strategy_uid], :name => :index_omniauth_uid
			index [:user_id], :name => :index_omniauth_user
		end

		create_table(:book_diff_stream, :ignore_index_errors => true) do
			primary_key :id
			Integer :book_id, :null=>false
			DateTime :created_at
			DateTime :updated_at

			File :payload, :size=>:medium # command-specific json payload, could be large
			String :type, :size=>128

			index [:book_id], :name=>:index_server_commands_book
		end

	end

	down do
		drop_table(:auth_logins, :server_commands, :users)
	end
end
